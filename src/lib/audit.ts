import { sql, once } from "./db";

/**
 * 變更稽核（規格 §51）：誰 / 何時 / 前後值 / 理由 / 是否經人工核准。
 * 高風險操作（刪商品、大量換連結、自動提曝光）必留痕。寫失敗不影響主流程。
 */
export const AUDIT_TABLE_SQL = `CREATE TABLE IF NOT EXISTS affiliate_audit_log (
    id          bigserial PRIMARY KEY,
    entity_type text NOT NULL,
    entity_id   text,
    action      text NOT NULL,
    actor       text NOT NULL DEFAULT 'agent',
    before_json jsonb,
    after_json  jsonb,
    reason      text,
    approved    boolean,
    created_at  timestamptz NOT NULL DEFAULT now()
  )`;

const ensureSchema = once(async () => {
  if (!sql) return;
  await sql.query(AUDIT_TABLE_SQL);
  await sql`CREATE INDEX IF NOT EXISTS idx_affiliate_audit_entity
    ON affiliate_audit_log(entity_type, entity_id)`;
});

export type Actor = "agent" | "admin" | "cron";

export interface AuditEntry {
  entityType: "product" | "link" | "order" | "click" | "import" | "system";
  entityId?: string | null;
  action: string;
  actor?: Actor;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  approved?: boolean | null;
}

export async function audit(e: AuditEntry): Promise<void> {
  if (!sql) return;
  try {
    await ensureSchema();
    await sql`INSERT INTO affiliate_audit_log
      (entity_type, entity_id, action, actor, before_json, after_json, reason, approved)
      VALUES (
        ${e.entityType},
        ${e.entityId ?? null},
        ${e.action},
        ${e.actor ?? "agent"},
        ${e.before == null ? null : JSON.stringify(e.before)}::jsonb,
        ${e.after == null ? null : JSON.stringify(e.after)}::jsonb,
        ${e.reason ?? null},
        ${e.approved ?? null}
      )`;
  } catch {
    /* 稽核寫入失敗不影響主流程 */
  }
}

export { ensureSchema as ensureAuditSchema };
