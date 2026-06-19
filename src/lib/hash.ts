import { createHash } from "node:crypto";
import { CLICK_HASH_SALT } from "./env";

/**
 * 把 session/cookie 值雜湊化後才存（不存原始值、不存 IP/email）。
 * 沒設鹽 → 回 null（不寫雜湊欄位）。換鹽即「忘記」舊關聯。
 * 使用 node crypto → 用到的 route 需 `export const runtime = "nodejs"`。
 */
export function hashSession(value: string | null | undefined): string | null {
  if (!value || !CLICK_HASH_SALT) return null;
  return createHash("sha256")
    .update(`${CLICK_HASH_SALT}:${value}`)
    .digest("hex")
    .slice(0, 32);
}
