import { timingSafeEqual } from "node:crypto";
import { ADMIN_KEY } from "./env";

export function verifyAdminKey(
  candidate: string | null | undefined,
  configured: string,
): boolean {
  if (!configured || !candidate) return false;
  const a = Buffer.from(candidate),
    b = Buffer.from(configured);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createAdminGuard(configured: string) {
  return (req: Request): Response | null => {
    const key =
      new URL(req.url).searchParams.get("key") ??
      req.headers.get("x-admin-key");
    return verifyAdminKey(key, configured)
      ? null
      : Response.json({ error: "forbidden" }, { status: 403 });
  };
}
export function isAdminKey(key: string | null | undefined): boolean {
  return verifyAdminKey(key, ADMIN_KEY);
}
export function checkAdmin(req: Request): boolean {
  return adminGuard(req) === null;
}
export const adminGuard = createAdminGuard(ADMIN_KEY);
