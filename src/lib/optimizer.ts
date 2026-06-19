import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { tmpdir } from "node:os";
import { overviewMetrics, productRevenue } from "./revenue";
import { findGaps, suggestAlternatives } from "./gaps";
import { listProducts } from "./products";
import { createProposals, type ProposalInput, type Proposal } from "./proposals";

// 「自動優化大腦」—— 用 Claude Agent SDK 跑一個 advisory 代理（規格 §39-42）。
// 鐵則:它只有「唯讀工具」+ 一個 submit_proposals 輸出工具;canUseTool 把所有非 TBTI 工具擋死。
// 它產出的是 pending 建議,人工核准後才由 proposals.ts 的決定論程式執行。不碰錢、不碰排序。

// 接受一般 API key（ANTHROPIC_API_KEY）或 Claude OAuth token（CLAUDE_CODE_OAUTH_TOKEN）。
// 兩者皆由 SDK 的 runtime 子行程從環境變數自動取用,這裡只判斷「有沒有設」。
export const optimizerEnabled = !!(
  process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_CODE_OAUTH_TOKEN
);
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const ok = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data) }] });

function buildServer(captured: ProposalInput[]) {
  return createSdkMcpServer({
    name: "tbti",
    version: "1.0.0",
    tools: [
      tool("get_overview", "TBTI 聯盟整體成效指標(點擊/訂單/佣金/狀態分布/失效率)", {}, async () =>
        ok(await overviewMetrics()),
      ),
      tool("get_product_performance", "每個商品近 30 日成效(CTR/轉換/佣金/取消率)", {}, async () => {
        const rows = await productRevenue(30);
        return ok(
          rows.slice(0, 50).map((r) => ({
            id: r.id, name: r.name, platform: r.platform, city: r.city, status: r.status,
            clicks: r.clicks, uniqueClicks: r.uniqueClicks, validOrders: r.validOrders,
            conversion: Number(r.conversion.toFixed(3)), commission: r.commission,
            cancelRate: Number(r.cancelRate.toFixed(3)),
          })),
        );
      }),
      tool("get_underperformers", "點很多卻 0 成交、或取消率過高的商品", {}, async () => {
        const rows = await productRevenue(30);
        const under = rows
          .filter((r) => (r.clicks >= 10 && r.validOrders === 0) || r.cancelRate > 0.3)
          .map((r) => ({ id: r.id, name: r.name, clicks: r.clicks, validOrders: r.validOrders, cancelRate: Number(r.cancelRate.toFixed(3)) }));
        return ok(under);
      }),
      tool("get_gaps", "人格 × 城市的覆蓋缺口", {}, async () => ok(await findGaps({ minPerCombo: 2 }))),
      tool("get_broken_products", "目前標記為 broken 的商品", {}, async () => {
        const { items } = await listProducts({ status: "broken", limit: 50 });
        return ok(items.map((p) => ({ id: p.id, name: p.productName, platform: p.platform, city: p.city })));
      }),
      tool("get_alternatives", "某商品的替代候選(同城市/類型)", { productId: z.string() }, async (a) =>
        ok(await suggestAlternatives(a.productId)),
      ),
      tool(
        "submit_proposals",
        "提交本輪優化建議(這是你唯一的輸出方式;呼叫一次即可)",
        {
          proposals: z.array(
            z.object({
              kind: z.enum(["pause", "boost", "retag", "replace", "add_gap"]),
              productId: z.string().optional(),
              rationale: z.string(),
              evidence: z.string().optional(),
              personas: z.array(z.string()).optional(),
              category: z.string().optional(),
              suggestedAlternativeId: z.string().optional(),
              city: z.string().optional(),
              persona: z.string().optional(),
            }),
          ),
        },
        async (a) => {
          for (const p of a.proposals) captured.push(p as ProposalInput);
          return ok({ received: a.proposals.length });
        },
      ),
    ],
  });
}

const SYSTEM = `你是 TBTI 聯盟商品的「優化分析師」。
- 你只能用工具「讀」資料,然後用 submit_proposals 提出建議。你無法、也不可執行任何變更——由人工核准後才執行。
- 絕對不要碰佣金、價格、排序權重。
- 每條建議都要根據你讀到的數據,並在 evidence 欄寫出具體數字。
- 寧可少而精:最多 8 條高把握度建議。
建議種類:
- pause:點很多卻長期 0 成交、或取消率過高 → 暫停(需 productId)
- boost:轉換好+佣金不錯+健康 → 增加曝光(需 productId)
- retag:商品與其人格/類型標籤不符 → 改標籤(需 productId + personas/category)
- replace:broken 商品 → 先用 get_alternatives 找替代,再建議替換(需 productId + suggestedAlternativeId)
- add_gap:某人格×城市沒有商品且值得補 → 補貨(需 persona + city)
流程:先呼叫需要的 get_* 工具了解現況,最後務必呼叫 submit_proposals 一次。`;

const PROMPT =
  "請分析目前 TBTI 聯盟商品的成效與缺口,提出本輪優化建議。先讀資料,最後用 submit_proposals 提交。";

export interface OptimizeResult {
  proposals: Proposal[];
  summary: string;
  turns: number;
  denials: number;
  costUsd: number;
}

export async function runOptimizer(): Promise<OptimizeResult | null> {
  if (!optimizerEnabled) return null;
  const captured: ProposalInput[] = [];
  const server = buildServer(captured);
  const ALLOWED = [
    "get_overview", "get_product_performance", "get_underperformers",
    "get_gaps", "get_broken_products", "get_alternatives", "submit_proposals",
  ].map((n) => `mcp__tbti__${n}`);

  const q = query({
    prompt: PROMPT,
    options: {
      model: MODEL,
      systemPrompt: SYSTEM,
      mcpServers: { tbti: server },
      allowedTools: ALLOWED,
      maxTurns: 16,
      permissionMode: "default",
      cwd: tmpdir(),
      // 硬護欄:任何非 TBTI 工具(Bash/Read/Write…)一律拒絕。
      canUseTool: async (toolName, input) => {
        if (toolName.startsWith("mcp__tbti__")) return { behavior: "allow" as const, updatedInput: input };
        return { behavior: "deny" as const, message: `blocked non-TBTI tool: ${toolName}` };
      },
    },
  });

  let summary = "";
  let turns = 0;
  let denials = 0;
  let costUsd = 0;
  for await (const msg of q) {
    if (msg.type === "result") {
      if (msg.subtype === "success") summary = msg.result;
      turns = msg.num_turns ?? 0;
      denials = msg.permission_denials?.length ?? 0;
      costUsd = msg.total_cost_usd ?? 0;
    }
  }

  const proposals = await createProposals(captured);
  return { proposals, summary, turns, denials, costUsd };
}
