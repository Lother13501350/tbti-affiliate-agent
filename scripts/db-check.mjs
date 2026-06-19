// 連到 DATABASE_URL，列出 public schema 的資料表並標示是否含「正式站」資料表。
// 用法：node --env-file=.env.local scripts/db-check.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const rows = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' ORDER BY 1`;
const names = rows.map((r) => r.table_name);
console.log(`PUBLIC TABLES (${names.length}): ${names.join(", ") || "(none)"}`);

// 正式站 travelmbti 的資料表 —— 若出現代表「不是獨立 DB」，要警告。
const PROD = [
  "user", "account", "session", "verification",
  "persona_counts", "pairs", "court_cases", "court_messages",
  "answer_logs", "subscribers", "rate_limits",
];
const hit = names.filter((n) => PROD.includes(n));
console.log(
  hit.length
    ? `⚠️  發現正式站資料表：${hit.join(", ")} —— 這不是獨立 DB！`
    : "✓ 未發現正式站資料表 —— 看起來是乾淨 / 獨立的資料庫。",
);

// 若 affiliate_* 已建，順便列出筆數
const AFF = [
  "affiliate_products", "affiliate_links", "affiliate_clicks",
  "affiliate_orders", "affiliate_import_batches", "affiliate_audit_log",
];
for (const t of AFF) {
  if (!names.includes(t)) continue;
  let n = 0;
  if (t === "affiliate_products") n = (await sql`SELECT count(*)::int n FROM affiliate_products`)[0].n;
  else if (t === "affiliate_links") n = (await sql`SELECT count(*)::int n FROM affiliate_links`)[0].n;
  else if (t === "affiliate_clicks") n = (await sql`SELECT count(*)::int n FROM affiliate_clicks`)[0].n;
  else if (t === "affiliate_orders") n = (await sql`SELECT count(*)::int n FROM affiliate_orders`)[0].n;
  else if (t === "affiliate_import_batches") n = (await sql`SELECT count(*)::int n FROM affiliate_import_batches`)[0].n;
  else if (t === "affiliate_audit_log") n = (await sql`SELECT count(*)::int n FROM affiliate_audit_log`)[0].n;
  console.log(`  ${t}: ${n} rows`);
}
