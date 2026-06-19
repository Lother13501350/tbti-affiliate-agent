import { getLink } from "@/lib/links";
import { logClick } from "@/lib/clicks";
import { SITE_URL } from "@/lib/env";
import { composeSubId, adapterById } from "@/lib/adapters";

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

  // 情境：人格 / 版位 / 目的地由主站 query 帶入，缺則用連結本身的預設。
  const persona = url.searchParams.get("persona") ?? link.personaCode;
  const placement = url.searchParams.get("placement") ?? link.placement;
  const dest = url.searchParams.get("dest") ?? link.dest;
  const sessionRaw =
    url.searchParams.get("s") ?? readCookie(req.headers.get("cookie"), "tbti_sid");

  // 點擊當下即時組情境 SubId，塞進平台連結（Klook=aff_label1 / KKday=ud1 / 其他=sub_id）。
  // 訂單報表會帶回這個 SubId → 匯入時反解，歸因到人格/版位。一條連結可服務多種人格。
  const subId = composeSubId({ persona, dest, placement, variant: link.variant });
  const target = adapterById(link.platform).appendSubId(link.baseUrl, subId);

  await logClick({
    linkCode: link.code,
    productId: link.productId,
    platform: link.platform,
    personaCode: persona,
    pagePath: url.searchParams.get("p"),
    placement,
    campaign: url.searchParams.get("c") ?? link.campaign,
    variant: link.variant,
    sessionRaw,
    userAgent: req.headers.get("user-agent"),
  });

  // aid/cid 在 base_url 內，SubId 即時加上後原樣帶出
  return Response.redirect(target, 302);
}
