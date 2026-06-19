import { recommendProducts } from "@/lib/recommend";
import { SITE_URL } from "@/lib/env";

// 公開推薦 API（給主站 tbtitest.com 取排序後的商品卡）。只回 active 商品 + /go 連結。
// CORS 開放：僅含公開商品資料，無敏感欄位。主站亦可改 server 端呼叫免 CORS。
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = { "access-control-allow-origin": "*" };

export function OPTIONS() {
  return new Response(null, {
    headers: { ...CORS, "access-control-allow-methods": "GET, OPTIONS" },
  });
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const persona = u.searchParams.get("persona");
  const recs = await recommendProducts({
    persona,
    city: u.searchParams.get("city"),
    country: u.searchParams.get("country"),
    budgetTier: u.searchParams.get("budget"),
    scenario: u.searchParams.get("scenario"),
    limit: Number(u.searchParams.get("limit") ?? 12) || 12,
  });
  const base = SITE_URL || new URL("/", req.url).origin;
  return Response.json(
    {
      items: recs.map((r) => {
        // 把情境帶進 goUrl → 點擊時 /go 會即時編成 SubId 做人格級歸因
        const q = new URLSearchParams();
        if (persona) q.set("persona", persona);
        if (r.product.city) q.set("dest", r.product.city);
        q.set("placement", "recommend");
        return {
          id: r.product.id,
          name: r.product.productName,
          platform: r.product.platform,
          city: r.product.city,
          category: r.product.category,
          price: r.product.priceFrom,
          currency: r.product.currency,
          image: r.product.imageUrl,
          goCode: r.goCode,
          goUrl: r.goCode ? `${base}/go/${r.goCode}?${q.toString()}` : null,
          score: Number(r.score.toFixed(3)),
        };
      }),
    },
    { headers: CORS },
  );
}
