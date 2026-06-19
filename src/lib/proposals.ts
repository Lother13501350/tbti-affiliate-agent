import { sql, once } from "./db";
import { setStatus, updateCuration, getProduct } from "./products";
import { cleanPersonaCodes } from "./personas";
import { audit } from "./audit";

// 優化建議（規格 §39-42）。Claude 代理只能「產生 pending 建議」，人工核准後才由這裡的
// 決定論程式執行。可執行的動作刻意很小且安全：pause / boost / retag。
// 絕不碰佣金、價格、排序權重。replace / add_gap 為純建議（核准=知悉，不自動執行）。

export type ProposalKind = "pause" | "boost" | "retag" | "replace" | "add_gap";
export const EXECUTABLE: ProposalKind[] = ["pause", "boost", "retag"];
export const PROPOSAL_KINDS: ProposalKind[] = ["pause", "boost", "retag", "replace", "add_gap"];

export interface ProposalInput {
  kind: ProposalKind;
  productId?: string | null;
  rationale: string;
  evidence?: string | null;
  personas?: string[] | null;
  category?: string | null;
  suggestedAlternativeId?: string | null;
  city?: string | null;
  persona?: string | null;
}

export interface Proposal extends ProposalInput {
  id: string;
  status: "pending" | "approved" | "rejected" | "applied";
  createdAt: string;
  decidedAt: string | null;
}

const ensureSchema = once(async () => {
  if (!sql) return;
  await sql`CREATE TABLE IF NOT EXISTS affiliate_proposals (
    id          text PRIMARY KEY,
    kind        text NOT NULL,
    product_id  text,
    payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
    status      text NOT NULL DEFAULT 'pending',
    created_at  timestamptz NOT NULL DEFAULT now(),
    decided_at  timestamptz
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_aff_proposals_status ON affiliate_proposals(status)`;
});

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToProposal(r: any): Proposal {
  const p = r.payload ?? {};
  return {
    id: r.id,
    kind: r.kind,
    productId: r.product_id ?? null,
    status: r.status,
    createdAt: r.created_at,
    decidedAt: r.decided_at ?? null,
    rationale: p.rationale ?? "",
    evidence: p.evidence ?? null,
    personas: p.personas ?? null,
    category: p.category ?? null,
    suggestedAlternativeId: p.suggestedAlternativeId ?? null,
    city: p.city ?? null,
    persona: p.persona ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function createProposals(list: ProposalInput[]): Promise<Proposal[]> {
  if (!sql || list.length === 0) return [];
  await ensureSchema();
  const out: Proposal[] = [];
  for (const p of list) {
    if (!PROPOSAL_KINDS.includes(p.kind)) continue;
    const id = crypto.randomUUID();
    const payload = {
      rationale: p.rationale ?? "",
      evidence: p.evidence ?? null,
      personas: p.personas ?? null,
      category: p.category ?? null,
      suggestedAlternativeId: p.suggestedAlternativeId ?? null,
      city: p.city ?? null,
      persona: p.persona ?? null,
    };
    const rows = await sql`
      INSERT INTO affiliate_proposals (id, kind, product_id, payload)
      VALUES (${id}, ${p.kind}, ${p.productId ?? null}, ${JSON.stringify(payload)}::jsonb)
      RETURNING *`;
    if (rows[0]) out.push(rowToProposal(rows[0]));
  }
  await audit({ entityType: "system", action: "proposals_created", actor: "agent", after: { count: out.length } });
  return out;
}

export async function listProposals(status?: string): Promise<Proposal[]> {
  if (!sql) return [];
  await ensureSchema();
  const rows = status
    ? await sql`SELECT * FROM affiliate_proposals WHERE status = ${status} ORDER BY created_at DESC LIMIT 200`
    : await sql`SELECT * FROM affiliate_proposals ORDER BY created_at DESC LIMIT 200`;
  return rows.map(rowToProposal);
}

/** 執行一條已核准建議（只有 EXECUTABLE 種類會真的動 DB）。 */
async function execute(p: Proposal): Promise<string> {
  if (!p.productId) return "no product to act on";
  if (p.kind === "pause") {
    await setStatus(p.productId, "paused");
    return "product paused";
  }
  if (p.kind === "boost") {
    const cur = await getProduct(p.productId);
    const next = Math.min(100, (cur?.recommendScore ?? 50) + 15); // 有上限,避免暴衝
    await updateCuration(p.productId, { recommendScore: next });
    return `recommend_score → ${next}`;
  }
  if (p.kind === "retag") {
    await updateCuration(p.productId, {
      personas: p.personas ? cleanPersonaCodes(p.personas) : undefined,
      category: p.category ?? undefined,
    });
    return "tags updated";
  }
  return "advisory only (no auto-execution)";
}

export async function decide(
  id: string,
  decision: "approved" | "rejected",
): Promise<{ proposal: Proposal | null; effect?: string }> {
  if (!sql) return { proposal: null };
  await ensureSchema();
  const cur = (await sql`SELECT * FROM affiliate_proposals WHERE id = ${id}`)[0];
  if (!cur) return { proposal: null };
  const p = rowToProposal(cur);
  if (p.status !== "pending") return { proposal: p, effect: "already decided" };

  if (decision === "rejected") {
    const rows = await sql`UPDATE affiliate_proposals SET status='rejected', decided_at=now() WHERE id=${id} RETURNING *`;
    await audit({ entityType: "system", entityId: id, action: "proposal_rejected", actor: "admin", before: p });
    return { proposal: rows[0] ? rowToProposal(rows[0]) : null };
  }

  const effect = await execute(p);
  const finalStatus = EXECUTABLE.includes(p.kind) ? "applied" : "approved";
  const rows = await sql`UPDATE affiliate_proposals SET status=${finalStatus}, decided_at=now() WHERE id=${id} RETURNING *`;
  await audit({
    entityType: p.productId ? "product" : "system",
    entityId: p.productId ?? id,
    action: `proposal_${p.kind}_applied`,
    actor: "admin",
    after: { proposal: p, effect },
    approved: true,
  });
  return { proposal: rows[0] ? rowToProposal(rows[0]) : null, effect };
}

export async function pendingCount(): Promise<number> {
  if (!sql) return 0;
  await ensureSchema();
  const r = await sql`SELECT count(*)::int n FROM affiliate_proposals WHERE status='pending'`;
  return r[0] ? Number(r[0].n) : 0;
}
