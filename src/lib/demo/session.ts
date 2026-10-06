import { deflateRawSync, inflateRawSync } from "node:zlib";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createWorkspace, type Workspace } from "./workspace";
const COOKIE = "affiliate_demo";
export function encodeWorkspace(state: Workspace, secret: string) {
  const payload = deflateRawSync(Buffer.from(JSON.stringify(state))).toString(
    "base64url",
  );
  const signed =
    payload +
    "." +
    createHmac("sha256", secret).update(payload).digest("base64url");
  if (signed.length > 3800)
    throw new Error("Sample workspace is full. Reset it to continue.");
  return signed;
}
export function decodeWorkspace(
  value: string | undefined,
  secret: string,
  now = Date.now(),
): Workspace | null {
  if (!value || value.length > 3800) return null;
  try {
    const [payload, sig, extra] = value.split(".");
    if (extra || !payload || !sig) return null;
    const actual = Buffer.from(sig, "base64url"),
      expected = createHmac("sha256", secret).update(payload).digest();
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return null;
    const s = JSON.parse(
      inflateRawSync(Buffer.from(payload, "base64url"), {
        maxOutputLength: 16000,
      }).toString(),
    ) as Workspace;
    if (
      s.expires <= now ||
      s.expires > now + 60 * 60 * 1000 + 1000 ||
      !["viewer", "reviewer"].includes(s.role)
    )
      return null;
    return s;
  } catch {
    return null;
  }
}
export function readWorkspace(req: Request, secret: string) {
  const value = req.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1);
  return decodeWorkspace(value, secret);
}
export function workspaceResponse(
  state: Workspace,
  secret: string,
  extra: object = {},
) {
  return Response.json(
    { state, ...extra },
    {
      headers: {
        "cache-control": "no-store",
        "set-cookie": `${COOKIE}=${encodeWorkspace(state, secret)}; Path=/api/demo; HttpOnly; SameSite=Strict; Max-Age=3600${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
      },
    },
  );
}
export { createWorkspace };
