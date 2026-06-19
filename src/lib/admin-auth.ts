import { ADMIN_KEY, adminEnabled } from "./env";

// 後台密碼閘（比照主站 /admin/answers 的 ADMIN_KEY 模式）。
// 未設 ADMIN_KEY → 一律拒絕（預設安全）。網址用 ?key=<值> 或 header x-admin-key。

export function isAdminKey(key: string | null | undefined): boolean {
  if (!adminEnabled) return false;
  return (key ?? "") === ADMIN_KEY;
}

export function checkAdmin(req: Request): boolean {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") ?? req.headers.get("x-admin-key") ?? "";
  return isAdminKey(key);
}

/** API 守門：未授權回 403 Response，授權回 null。 */
export function adminGuard(req: Request): Response | null {
  if (!checkAdmin(req)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
}
