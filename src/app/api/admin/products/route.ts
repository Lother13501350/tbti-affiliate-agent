import { adminGuard } from "@/lib/admin-auth";
import { upsertProduct, listProducts } from "@/lib/products";
import type { ProductStatus } from "@/lib/taxonomy";
import { createLink, listLinksForProduct } from "@/lib/links";
import { detectPlatform } from "@/lib/adapters";
import { cleanPersonaCodes } from "@/lib/personas";
import { audit } from "@/lib/audit";
import { z } from "zod";

export const runtime = "nodejs";

const CreateSchema = z.object({
  productName: z.string().min(1),
  productUrl: z.string().url().optional(),
  affiliateUrl: z.string().url().optional(),
  platform: z.string().optional(),
  externalProductId: z.string().optional(),
  countryCode: z.string().optional(),
  countryName: z.string().optional(),
  city: z.string().optional(),
  category: z.string().optional(),
  priceFrom: z.coerce.number().optional(),
  currency: z.string().optional(),
  commissionRate: z.coerce.number().optional(),
  personas: z.array(z.string()).optional(),
  scenarios: z.array(z.string()).optional(),
  audience: z.array(z.string()).optional(),
  budgetTier: z.string().optional(),
  status: z.string().optional(),
  createDefaultLink: z.boolean().optional(),
});

export async function GET(req: Request) {
  const denied = adminGuard(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const res = await listProducts({
    platform: url.searchParams.get("platform"),
    status: url.searchParams.get("status"),
    city: url.searchParams.get("city"),
    persona: url.searchParams.get("persona"),
    q: url.searchParams.get("q"),
    needsReview: url.searchParams.get("needsReview") === "1" ? true : null,
    limit: Number(url.searchParams.get("limit") ?? 50),
    offset: Number(url.searchParams.get("offset") ?? 0),
  });
  return Response.json(res);
}

export async function POST(req: Request) {
  const denied = adminGuard(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  }
  const d = parsed.data;
  const baseUrl = d.affiliateUrl ?? d.productUrl ?? "";
  const platform = d.platform ?? detectPlatform(baseUrl);
  const estimatedCommission =
    d.priceFrom != null && d.commissionRate != null
      ? Number(((d.priceFrom * d.commissionRate) / 100).toFixed(2))
      : null;

  const product = await upsertProduct({
    platform,
    externalProductId: d.externalProductId,
    productName: d.productName,
    productUrl: d.productUrl,
    affiliateUrl: d.affiliateUrl,
    countryCode: d.countryCode,
    countryName: d.countryName,
    city: d.city,
    category: d.category,
    priceFrom: d.priceFrom,
    currency: d.currency,
    commissionRate: d.commissionRate,
    estimatedCommission,
    personas: d.personas ? cleanPersonaCodes(d.personas) : undefined,
    scenarios: d.scenarios,
    audience: d.audience,
    budgetTier: d.budgetTier,
    status: (d.status as ProductStatus) ?? "pending_review",
    needsReview: true, // 人工新增也先進審核，確認標籤後再 active
  });
  if (!product) return Response.json({ error: "db disabled" }, { status: 503 });
  await audit({ entityType: "product", entityId: product.id, action: "create", actor: "admin", after: product });

  let link = null;
  if (d.affiliateUrl && (d.createDefaultLink ?? true)) {
    const existing = await listLinksForProduct(product.id);
    if (existing.length === 0) {
      link = await createLink({
        productId: product.id,
        platform,
        baseAffiliateUrl: d.affiliateUrl,
        dest: d.city ?? null,
      });
    }
  }
  return Response.json({ product, link });
}
