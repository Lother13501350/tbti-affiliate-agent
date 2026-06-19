// 集中式環境變數與開關。缺值 → 對應功能 graceful no-op（比照主站 travelmbti 的做法）。
// 只在 server 端讀取；切勿在 client component 直接 import 這裡的非 NEXT_PUBLIC_ 值。

export const DB_URL = process.env.DATABASE_URL ?? "";
export const dbEnabled = DB_URL.length > 0;

export const ADMIN_KEY = process.env.ADMIN_KEY ?? "";
export const adminEnabled = ADMIN_KEY.length > 0;

/**
 * Kill switch（規格 §52）。false/未設 → Agent 唯讀 + 只報告，不做寫入型自動化。
 * 寫入型動作（匯入落庫、狀態變更、產生連結、健康檢查改狀態）都要先過這關。
 */
export const AGENT_WRITE_ENABLED = /^(1|true)$/i.test(
  process.env.AGENT_WRITE_ENABLED ?? "",
);

/** 點擊 session 雜湊鹽；未設 → 不寫 session 雜湊（仍記其他情境欄位）。 */
export const CLICK_HASH_SALT = process.env.CLICK_HASH_SALT ?? "";

export const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL ?? "";
export const discordEnabled = DISCORD_WEBHOOK_URL.length > 0;

export const CRON_SECRET = process.env.CRON_SECRET ?? "";

/** Claude Agent SDK 的「優化大腦」是否可用。接受 API key 或 OAuth token（缺則停用，不載入 SDK）。 */
export const ANTHROPIC_ENABLED = !!(
  process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_CODE_OAUTH_TOKEN
);

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? ""
).replace(/\/$/, "");

export const IS_PROD = process.env.NODE_ENV === "production";
