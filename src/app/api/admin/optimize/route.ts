import { adminGuard } from "@/lib/admin-auth";
import { runOptimizer, optimizerEnabled } from "@/lib/optimizer";

// 觸發一輪「優化大腦」分析（規格 §39-42）。ADMIN_KEY 閘。
// 注意:Claude Agent SDK 會 spawn 內含執行檔的子行程 → production 建議跑在「非 serverless」環境
// (本機 / 專用 Node 主機 / 夠長的排程),Vercel 函式時限可能不夠。
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const denied = adminGuard(req);
  if (denied) return denied;
  if (!optimizerEnabled) {
    return Response.json({ error: "optimizer disabled", hint: "設定 ANTHROPIC_API_KEY 後啟用" }, { status: 503 });
  }
  try {
    const r = await runOptimizer();
    return Response.json(r ?? { error: "disabled" });
  } catch (e) {
    return Response.json({ error: "optimizer failed", detail: String(e) }, { status: 502 });
  }
}
