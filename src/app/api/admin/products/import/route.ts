import { adminGuard } from "@/lib/admin-auth";
import { parseCsv, pick } from "@/lib/csv";
import { money } from "@/lib/adapters/base";
import { detectPlatform } from "@/lib/adapters";
import { upsertProduct } from "@/lib/products";
import type { ProductStatus } from "@/lib/taxonomy";
import { createLink, listLinksForProduct } from "@/lib/links";
import { cleanPersonaCodes } from "@/lib/personas";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

const splitList = (s: string): string[] =>
  s.split(/[,|;、，]/).map((x) => x.trim()).filter(Boolean);

// 商品 CSV 批次匯入（規格 §1）。body: { csv, platform?, defaultStatus? }。
// 欄名容錯（中英皆可）。同平台同 external id 自動去重（upsert）。抓不到平台 → 由網址辨識。
export async function POST(req: Request) {
  const denied = adminGuard(req);
  if (denied) return denied;

  let body: { csv?: string; platform?: string; defaultStatus?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.csv) return Response.json({ error: "missing csv" }, { status: 400 });

  const rows = parseCsv(body.csv);
  let processed = 0;
  let linksCreated = 0;
  let errors = 0;
  const ids: string[] = [];

  for (const row of rows) {
    const productName = pick(row, ["product name", "name", "title", "商品名稱", "商品", "標題"]);
    const productUrl = pick(row, ["product url", "url", "link", "商品網址", "網址", "連結"]);
    const affiliateUrl = pick(row, ["affiliate url", "aff url", "tracking url", "分潤網址", "聯盟連結", "推廣連結"]);
    if (!productName && !productUrl && !affiliateUrl) {
      continue; // 空列
    }
    if (!productName) {
      errors++;
      continue; // 名稱必填（不捏造）
    }
    const platform =
      pick(row, ["platform", "平台"]) ||
      body.platform ||
      detectPlatform(affiliateUrl || productUrl || "");
    const priceFrom = money(pick(row, ["price", "price from", "顯示價格", "價格"]));
    const commissionRate = money(pick(row, ["commission rate", "rate", "分潤率", "佣金率"]));
    const personas = cleanPersonaCodes(splitList(pick(row, ["personas", "persona", "人格"])));

    try {
      const product = await upsertProduct({
        platform,
        externalProductId: pick(row, ["product id", "external id", "sku", "商品編號", "產品編號"]) || null,
        productName,
        productUrl: productUrl || null,
        affiliateUrl: affiliateUrl || null,
        countryCode: pick(row, ["country code", "country", "國家"]) || null,
        city: pick(row, ["city", "城市"]) || null,
        category: pick(row, ["category", "type", "類型", "商品類型"]) || null,
        priceFrom,
        currency: pick(row, ["currency", "幣別"]) || null,
        commissionRate,
        estimatedCommission:
          priceFrom != null && commissionRate != null
            ? Number(((priceFrom * commissionRate) / 100).toFixed(2))
            : null,
        personas,
        status: ((body.defaultStatus as ProductStatus) || "pending_review"),
        needsReview: true,
      });
      if (!product) {
        errors++;
        continue;
      }
      processed++;
      ids.push(product.id);
      if (affiliateUrl) {
        const existing = await listLinksForProduct(product.id);
        if (existing.length === 0) {
          await createLink({
            productId: product.id,
            platform,
            baseAffiliateUrl: affiliateUrl,
            dest: pick(row, ["city", "城市"]) || null,
          });
          linksCreated++;
        }
      }
    } catch {
      errors++;
    }
  }

  await audit({
    entityType: "import",
    action: "products_csv",
    actor: "admin",
    after: { rows: rows.length, processed, linksCreated, errors },
  });

  return Response.json({ rows: rows.length, processed, linksCreated, errors, ids });
}
