import { getLink } from "@/lib/links";
import { logClick } from "@/lib/clicks";
import { SITE_URL } from "@/lib/env";

// 站內跳轉（規格 §14）：解析 code → 記一筆點擊（best-effort）→ 302 到聯盟連結。
// 比照主站 /api/ad/[id]：記錄失敗絕不擋轉址。用 node runtime（clicks → hash 用 node crypto）。
export const runtime = "nodejs";

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const url = new URL(req.url);
  const homeUrl = SITE_URL || new URL("/", req.url).toString();

  const link = await getLink(code);
  if (!link) {
    // 未知 / 已停用 code → 回首頁，不爆（規格 §24 失效降級）
    return Response.redirect(homeUrl, 302);
  }

  // 情境：人格 / 版位 / campaign 以連結本身為準；頁面與 session 可由主站帶 query 覆寫。
  const sessionRaw =
    url.searchParams.get("s") ?? readCookie(req.headers.get("cookie"), "tbti_sid");

  await logClick({
    linkCode: link.code,
    productId: link.productId,
    platform: link.platform,
    personaCode: url.searchParams.get("persona") ?? link.personaCode,
    pagePath: url.searchParams.get("p"),
    placement: url.searchParams.get("placement") ?? link.placement,
    campaign: url.searchParams.get("c") ?? link.campaign,
    variant: link.variant,
    sessionRaw,
    userAgent: req.headers.get("user-agent"),
  });

  // 原樣帶出聯盟連結（cid / ud1 / sub_id 已在 target_url 內）
  return Response.redirect(link.targetUrl, 302);
}
