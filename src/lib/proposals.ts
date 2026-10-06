import { sql, once } from "./db";
import { ensureProductSchema } from "./products";
import { cleanPersonaCodes } from "./personas";
import { PROPOSAL_DECISION_SQL } from "./workflow-sql";
import { audit, ensureAuditSchema } from "./audit";

// 優化建議（規格 §39-42）。Claude 代理只能「產生 pending 建議」，人工核准後才由這裡的
// 決定論程式執行。可執行的動作刻意很小且安全：pause / boost / retag。
// 不修改佣金或價格；boost 僅提高有上限的 recommendation score。
// replace / add_gap 為純建議（核准=知悉，不自動執行）。

export type ProposalKind = "pause" | "boost" | "retag" | "replace" | "add_gap";
export const EXECUTABLE: ProposalKind[] = ["pause", "boost", "retag"];
export const PROPOSAL_KINDS: ProposalKind[] = [
  "pause",
  "boost",
  "retag",
  "replace",
  "add_gap",
];

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

export const PROPOSAL_TABLE_SQL = `CREATE TABLE IF NOT EXISTS affiliate_proposals (
    id          text PRIMARY KEY,
    kind        text NOT NULL,
    product_id  text,
    payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
    status      text NOT NULL DEFAULT 'pending',
    created_at  timestamptz NOT NULL DEFAULT now(),
    decided_at  timestamptz
  )`;

const ensureSchema = once(async () => {
  if (!sql) return;
  await sql.query(PROPOSAL_TABLE_SQL);
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
    personas: p.personas ? cleanPersonaCodes(p.personas) : null,
    category: p.category ?? null,
    suggestedAlternativeId: p.suggestedAlternativeId ?? null,
    city: p.city ?? null,
    persona: p.persona ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function createProposals(
  list: ProposalInput[],
): Promise<Proposal[]> {
  if (!sql || list.length === 0) return [];
  await ensureSchema();
  const out: Proposal[] = [];
  for (const p of list) {
    if (!PROPOSAL_KINDS.includes(p.kind)) continue;
    const id = crypto.randomUUID();
    const payload = {
      rationale: p.rationale ?? "",
      evidence: p.evidence ?? null,
      personas: p.personas ? cleanPersonaCodes(p.personas) : null,
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
  await audit({
    entityType: "system",
    action: "proposals_created",
    actor: "agent",
    after: { count: out.length },
  });
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

const ensureDecisionSchema = once(async () => {
  await ensureSchema();
  await ensureProductSchema();
  await ensureAuditSchema();
  if (sql) await sql.query(PROPOSAL_DECISION_SQL);
});

/** Approval, product mutation, and audit commit atomically. */
export async function decide(
  id: string,
  decision: "approved" | "rejected",
): Promise<{ proposal: Proposal | null; effect?: string }> {
  if (!sql) return { proposal: null };
  await ensureDecisionSchema();
  const rows = await sql.query(
    "SELECT affiliate_decide_proposal($1,$2) result",
    [id, decision],
  );
  const r = rows[0].result;
  return {
    proposal: r.proposal ? rowToProposal(r.proposal) : null,
    effect: r.effect,
  };
}

export async function pendingCount(): Promise<number> {
  if (!sql) return 0;
  await ensureSchema();
  const r =
    await sql`SELECT count(*)::int n FROM affiliate_proposals WHERE status='pending'`;
  return r[0] ? Number(r[0].n) : 0;
}
