import { sql, once } from "./db";
import type { TargetProfile } from "./personas";
import type { ProductStatus } from "./taxonomy";

// affiliate_products —— 統一商品主表（規格 §4,5,6,7-11,17）。
// 三平台欄位不同 → Adapter 先轉成這個統一形狀再落庫。多值欄位一律用 jsonb（避免 array 編碼歧義）。

const ensureSchema = once(async () => {
  if (!sql) return;
  await sql`CREATE TABLE IF NOT EXISTS affiliate_products (
    id                        text PRIMARY KEY,
    platform                  text NOT NULL,
    external_product_id       text,
    product_name              text NOT NULL,
    product_url               text,
    affiliate_url             text,
    country_code              text,
    country_name              text,
    city                      text,
    category                  text,
    subcategory               text,
    price_from                numeric,
    currency                  text,
    commission_rate           numeric,
    estimated_commission      numeric,
    status                    text NOT NULL DEFAULT 'draft',
    image_url                 text,
    description               text,
    personas                  jsonb NOT NULL DEFAULT '[]'::jsonb,
    target_profile            jsonb,
    scenarios                 jsonb NOT NULL DEFAULT '[]'::jsonb,
    budget_tier               text,
    audience                  jsonb NOT NULL DEFAULT '[]'::jsonb,
    classification_confidence numeric,
    recommend_score           numeric,
    needs_review              boolean NOT NULL DEFAULT false,
    created_at                timestamptz NOT NULL DEFAULT now(),
    updated_at                timestamptz NOT NULL DEFAULT now(),
    last_checked_at           timestamptz
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_aff_products_status ON affiliate_products(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_aff_products_platform ON affiliate_products(platform)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_aff_products_city ON affiliate_products(city)`;
});

export interface Product {
  id: string;
  platform: string;
  externalProductId: string | null;
  productName: string;
  productUrl: string | null;
  affiliateUrl: string | null;
  countryCode: string | null;
  countryName: string | null;
  city: string | null;
  category: string | null;
  subcategory: string | null;
  priceFrom: number | null;
  currency: string | null;
  commissionRate: number | null;
  estimatedCommission: number | null;
  status: ProductStatus;
  imageUrl: string | null;
  description: string | null;
  personas: string[];
  targetProfile: TargetProfile | null;
  scenarios: string[];
  budgetTier: string | null;
  audience: string[];
  classificationConfidence: number | null;
  recommendScore: number | null;
  needsReview: boolean;
  createdAt: string;
  updatedAt: string;
  lastCheckedAt: string | null;
}

export interface ProductInput {
  id?: string;
  platform: string;
  externalProductId?: string | null;
  productName: string;
  productUrl?: string | null;
  affiliateUrl?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  city?: string | null;
  category?: string | null;
  subcategory?: string | null;
  priceFrom?: number | null;
  currency?: string | null;
  commissionRate?: number | null;
  estimatedCommission?: number | null;
  status?: ProductStatus;
  imageUrl?: string | null;
  description?: string | null;
  personas?: string[];
  targetProfile?: TargetProfile | null;
  scenarios?: string[];
  budgetTier?: string | null;
  audience?: string[];
  classificationConfidence?: number | null;
  recommendScore?: number | null;
  needsReview?: boolean;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToProduct(r: any): Product {
  return {
    id: r.id,
    platform: r.platform,
    externalProductId: r.external_product_id ?? null,
    productName: r.product_name,
    productUrl: r.product_url ?? null,
    affiliateUrl: r.affiliate_url ?? null,
    countryCode: r.country_code ?? null,
    countryName: r.country_name ?? null,
    city: r.city ?? null,
    category: r.category ?? null,
    subcategory: r.subcategory ?? null,
    priceFrom: num(r.price_from),
    currency: r.currency ?? null,
    commissionRate: num(r.commission_rate),
    estimatedCommission: num(r.estimated_commission),
    status: r.status,
    imageUrl: r.image_url ?? null,
    description: r.description ?? null,
    personas: Array.isArray(r.personas) ? r.personas : [],
    targetProfile: r.target_profile ?? null,
    scenarios: Array.isArray(r.scenarios) ? r.scenarios : [],
    budgetTier: r.budget_tier ?? null,
    audience: Array.isArray(r.audience) ? r.audience : [],
    classificationConfidence: num(r.classification_confidence),
    recommendScore: num(r.recommend_score),
    needsReview: !!r.needs_review,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastCheckedAt: r.last_checked_at ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** 同平台同 external id → 同一個 id（自動去重，規格 §15）；無 external id → 新生成。 */
export function makeProductId(platform: string, externalId?: string | null): string {
  const p = platform.trim().toLowerCase();
  if (externalId && externalId.trim()) return `${p}:${externalId.trim()}`;
  return `${p}:${crypto.randomUUID().slice(0, 12)}`;
}

/**
 * 落庫一個商品。同 id 已存在 → 只更新「平台來源欄位」，保留人工策展欄位
 * （status / personas / 各種標籤 / recommend_score 不被匯入覆蓋）。
 */
export async function upsertProduct(input: ProductInput): Promise<Product | null> {
  if (!sql) return null;
  await ensureSchema();
  const id = input.id ?? makeProductId(input.platform, input.externalProductId);
  const rows = await sql`
    INSERT INTO affiliate_products (
      id, platform, external_product_id, product_name, product_url, affiliate_url,
      country_code, country_name, city, category, subcategory,
      price_from, currency, commission_rate, estimated_commission,
      status, image_url, description,
      personas, target_profile, scenarios, budget_tier, audience,
      classification_confidence, recommend_score, needs_review
    ) VALUES (
      ${id}, ${input.platform}, ${input.externalProductId ?? null}, ${input.productName},
      ${input.productUrl ?? null}, ${input.affiliateUrl ?? null},
      ${input.countryCode ?? null}, ${input.countryName ?? null}, ${input.city ?? null},
      ${input.category ?? null}, ${input.subcategory ?? null},
      ${input.priceFrom ?? null}, ${input.currency ?? null},
      ${input.commissionRate ?? null}, ${input.estimatedCommission ?? null},
      ${input.status ?? "draft"}, ${input.imageUrl ?? null}, ${input.description ?? null},
      ${JSON.stringify(input.personas ?? [])}::jsonb,
      ${input.targetProfile == null ? null : JSON.stringify(input.targetProfile)}::jsonb,
      ${JSON.stringify(input.scenarios ?? [])}::jsonb,
      ${input.budgetTier ?? null},
      ${JSON.stringify(input.audience ?? [])}::jsonb,
      ${input.classificationConfidence ?? null}, ${input.recommendScore ?? null},
      ${input.needsReview ?? false}
    )
    ON CONFLICT (id) DO UPDATE SET
      product_name         = EXCLUDED.product_name,
      product_url          = EXCLUDED.product_url,
      affiliate_url        = EXCLUDED.affiliate_url,
      country_code         = EXCLUDED.country_code,
      country_name         = EXCLUDED.country_name,
      city                 = EXCLUDED.city,
      category             = COALESCE(EXCLUDED.category, affiliate_products.category),
      subcategory          = COALESCE(EXCLUDED.subcategory, affiliate_products.subcategory),
      price_from           = EXCLUDED.price_from,
      currency             = EXCLUDED.currency,
      commission_rate      = COALESCE(EXCLUDED.commission_rate, affiliate_products.commission_rate),
      estimated_commission = COALESCE(EXCLUDED.estimated_commission, affiliate_products.estimated_commission),
      image_url            = EXCLUDED.image_url,
      description          = EXCLUDED.description,
      needs_review         = EXCLUDED.needs_review,
      updated_at           = now()
    RETURNING *`;
  return rows[0] ? rowToProduct(rows[0]) : null;
}

export interface ProductFilter {
  platform?: string | null;
  status?: string | null;
  city?: string | null;
  persona?: string | null;
  q?: string | null;
  needsReview?: boolean | null;
  limit?: number;
  offset?: number;
}

export async function listProducts(
  f: ProductFilter = {},
): Promise<{ items: Product[]; total: number }> {
  if (!sql) return { items: [], total: 0 };
  await ensureSchema();
  const limit = Math.min(Math.max(f.limit ?? 50, 1), 200);
  const offset = Math.max(f.offset ?? 0, 0);
  const cityLike = f.city ? `%${f.city}%` : null;
  const qLike = f.q ? `%${f.q}%` : null;
  const personaJson = f.persona ? JSON.stringify([f.persona]) : null;
  const rows = await sql`
    SELECT *, COUNT(*) OVER() AS _total
    FROM affiliate_products
    WHERE (${f.platform ?? null}::text IS NULL OR platform = ${f.platform ?? null})
      AND (${f.status ?? null}::text IS NULL OR status = ${f.status ?? null})
      AND (${cityLike}::text IS NULL OR city ILIKE ${cityLike})
      AND (${personaJson}::jsonb IS NULL OR personas @> ${personaJson}::jsonb)
      AND (${qLike}::text IS NULL OR product_name ILIKE ${qLike})
      AND (${f.needsReview ?? null}::boolean IS NULL OR needs_review = ${f.needsReview ?? null})
    ORDER BY updated_at DESC
    LIMIT ${limit} OFFSET ${offset}`;
  const total = rows[0] ? Number(rows[0]._total) : 0;
  return { items: rows.map(rowToProduct), total };
}

export async function getProduct(id: string): Promise<Product | null> {
  if (!sql) return null;
  await ensureSchema();
  const rows = await sql`SELECT * FROM affiliate_products WHERE id = ${id}`;
  return rows[0] ? rowToProduct(rows[0]) : null;
}

export async function setStatus(id: string, status: ProductStatus): Promise<Product | null> {
  if (!sql) return null;
  await ensureSchema();
  const rows = await sql`
    UPDATE affiliate_products SET status = ${status}, updated_at = now()
    WHERE id = ${id} RETURNING *`;
  return rows[0] ? rowToProduct(rows[0]) : null;
}

/** 標記檢查時間（健康檢查用）。 */
export async function touchChecked(id: string): Promise<void> {
  if (!sql) return;
  await ensureSchema();
  await sql`UPDATE affiliate_products SET last_checked_at = now() WHERE id = ${id}`;
}

/** 更新策展欄位（人工編輯 / 審核指定人格）。只更新有給的欄位。 */
export async function updateCuration(
  id: string,
  patch: {
    personas?: string[];
    scenarios?: string[];
    audience?: string[];
    budgetTier?: string | null;
    category?: string | null;
    targetProfile?: TargetProfile | null;
    recommendScore?: number | null;
    needsReview?: boolean;
  },
): Promise<Product | null> {
  if (!sql) return null;
  await ensureSchema();
  const rows = await sql`
    UPDATE affiliate_products SET
      personas        = COALESCE(${patch.personas ? JSON.stringify(patch.personas) : null}::jsonb, personas),
      scenarios       = COALESCE(${patch.scenarios ? JSON.stringify(patch.scenarios) : null}::jsonb, scenarios),
      audience        = COALESCE(${patch.audience ? JSON.stringify(patch.audience) : null}::jsonb, audience),
      budget_tier     = COALESCE(${patch.budgetTier ?? null}, budget_tier),
      category        = COALESCE(${patch.category ?? null}, category),
      target_profile  = COALESCE(${patch.targetProfile == null ? null : JSON.stringify(patch.targetProfile)}::jsonb, target_profile),
      recommend_score = COALESCE(${patch.recommendScore ?? null}, recommend_score),
      needs_review    = COALESCE(${patch.needsReview ?? null}, needs_review),
      updated_at      = now()
    WHERE id = ${id} RETURNING *`;
  return rows[0] ? rowToProduct(rows[0]) : null;
}

/** 後台儀表板：各狀態商品數。 */
export async function statusCounts(): Promise<Record<string, number>> {
  if (!sql) return {};
  await ensureSchema();
  const rows = await sql`SELECT status, COUNT(*)::int AS n FROM affiliate_products GROUP BY status`;
  const out: Record<string, number> = {};
  for (const r of rows) out[r.status] = Number(r.n);
  return out;
}

/** 取 active 商品（給健康檢查 / 主站渲染）。 */
export async function listActiveForCheck(limit = 500): Promise<Product[]> {
  if (!sql) return [];
  await ensureSchema();
  const rows = await sql`
    SELECT * FROM affiliate_products
    WHERE status = 'active'
    ORDER BY last_checked_at ASC NULLS FIRST
    LIMIT ${limit}`;
  return rows.map(rowToProduct);
}
