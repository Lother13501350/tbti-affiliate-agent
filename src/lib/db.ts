import { neon } from "@neondatabase/serverless";
import { DB_URL, dbEnabled } from "./env";

/**
 * 共用 Neon client（HTTP），比照主站 travelmbti：缺 DATABASE_URL → null，呼叫端 no-op。
 * 每個 domain 模組各自 lazy `CREATE TABLE IF NOT EXISTS`（無 migration 系統）。
 *
 * 用法：
 *   import { sql } from "@/lib/db";
 *   if (!sql) return; // 沒 DB 就略過
 *   await sql`SELECT 1`;
 */
export const sql = dbEnabled ? neon(DB_URL) : null;

export { dbEnabled };

/** 把模組級 ensureSchema 包成「只跑一次」的 helper，避免每次查詢都 DDL。 */
export function once(fn: () => Promise<void>): () => Promise<void> {
  let done = false;
  let inflight: Promise<void> | null = null;
  return async () => {
    if (done) return;
    if (!inflight) {
      inflight = fn().then(
        () => {
          done = true;
          inflight = null;
        },
        (e) => {
          inflight = null;
          throw e;
        },
      );
    }
    await inflight;
  };
}
