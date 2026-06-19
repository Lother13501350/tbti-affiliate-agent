import { sql, once } from "./db";
import { hashSession } from "./hash";

// affiliate_clicks —— 升級版點擊記錄（規格 §26-28）。
// 隱私守則（延續主站 ad_clicks / answer_logs）：
//   - 存「情境」欄位（人格碼 / 頁面 / 版位 / campaign）+ 雜湊化 session。
//   - 絕不存原始 IP / email / 完整 UA。device_type 只存粗分類，非 PII。

const ensureSchema = once(async () => {
  if (!sql) return;
  await sql`CREATE TABLE IF NOT EXISTS affiliate_clicks (
    id           bigserial PRIMARY KEY,
    click_id     text NOT NULL,
    link_code    text,
    product_id   text,
    platform     text,
    persona_code text,
    page_path    text,
    placement    text,
    campaign     text,
    variant      text,
    session_hash text,
    device_type  text,
    is_bot       boolean NOT NULL DEFAULT false,
    created_at   timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_aff_clicks_product ON affiliate_clicks(product_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_aff_clicks_created ON affiliate_clicks(created_at)`;
});

const BOT_RE = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|monitor|preview/i;

export function deviceType(ua: string | null | undefined): string {
  if (!ua) return "unknown";
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobi|android|iphone/i.test(ua)) return "mobile";
  return "desktop";
}

export function looksLikeBot(ua: string | null | undefined): boolean {
  if (!ua) return true; // 無 UA 的大量點擊視為可疑（規格 §28）
  return BOT_RE.test(ua);
}

export interface ClickInput {
  linkCode?: string | null;
  productId?: string | null;
  platform?: string | null;
  personaCode?: string | null;
  pagePath?: string | null;
  placement?: string | null;
  campaign?: string | null;
  variant?: string | null;
  /** 原始 session/cookie 值；會被雜湊後才存。 */
  sessionRaw?: string | null;
  /** 用來推 device_type 與 bot 判斷；不入庫。 */
  userAgent?: string | null;
}

/** 寫一筆點擊。永不丟例外、永不擋轉址（best-effort）。回傳 click_id 供下游歸因。 */
export async function logClick(input: ClickInput): Promise<string> {
  const clickId = crypto.randomUUID();
  if (!sql) return clickId;
  try {
    await ensureSchema();
    await sql`INSERT INTO affiliate_clicks
      (click_id, link_code, product_id, platform, persona_code, page_path,
       placement, campaign, variant, session_hash, device_type, is_bot)
      VALUES (
        ${clickId}, ${input.linkCode ?? null}, ${input.productId ?? null},
        ${input.platform ?? null}, ${input.personaCode ?? null}, ${input.pagePath ?? null},
        ${input.placement ?? null}, ${input.campaign ?? null}, ${input.variant ?? null},
        ${hashSession(input.sessionRaw)}, ${deviceType(input.userAgent)},
        ${looksLikeBot(input.userAgent)}
      )`;
  } catch {
    /* 記錄失敗不影響轉址 */
  }
  return clickId;
}

export interface ProductClickStat {
  productId: string;
  raw: number;
  uniqueSessions: number;
}

/** 每商品點擊統計（排除 bot），區分 raw 與 unique session（規格 §27,35）。 */
export async function productClickStats(sinceDays = 7): Promise<Map<string, ProductClickStat>> {
  const out = new Map<string, ProductClickStat>();
  if (!sql) return out;
  await ensureSchema();
  const rows = await sql`
    SELECT product_id,
           COUNT(*)::int AS raw,
           COUNT(DISTINCT session_hash)::int AS uniq
    FROM affiliate_clicks
    WHERE is_bot = false
      AND product_id IS NOT NULL
      AND created_at >= now() - (${sinceDays} || ' days')::interval
    GROUP BY product_id`;
  for (const r of rows) {
    out.set(r.product_id, {
      productId: r.product_id,
      raw: Number(r.raw),
      uniqueSessions: Number(r.uniq),
    });
  }
  return out;
}

/** 期間內總點擊（排除 bot）。 */
export async function totalClicks(sinceDays = 1): Promise<number> {
  if (!sql) return 0;
  await ensureSchema();
  const rows = await sql`
    SELECT COUNT(*)::int AS n FROM affiliate_clicks
    WHERE is_bot = false AND created_at >= now() - (${sinceDays} || ' days')::interval`;
  return rows[0] ? Number(rows[0].n) : 0;
}
