import { sql, once } from "./db";
import { createHash } from "node:crypto";
import { isPersonaCode } from "./personas";
import { normalizeOrderStatus, PLACEMENT_CODES } from "./taxonomy";
import type { NormalizedOrder } from "./adapters/types";

// affiliate_orders + affiliate_import_batches（規格 §29-34）。
// 防重複匯入：整檔 content_hash 去重 + 每筆 (platform, external_order_id) 唯一去重。

const ensureSchema = once(async () => {
  if (!sql) return;
  await sql`CREATE TABLE IF NOT EXISTS affiliate_import_batches (
    id           text PRIMARY KEY,
    kind         text NOT NULL,
    platform     text,
    source       text,
    row_count    int NOT NULL DEFAULT 0,
    inserted     int NOT NULL DEFAULT 0,
    updated      int NOT NULL DEFAULT 0,
    duplicates   int NOT NULL DEFAULT 0,
    errors       int NOT NULL DEFAULT 0,
    content_hash text,
    created_at   timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_aff_batches_hash ON affiliate_import_batches(content_hash)`;
  await sql`CREATE TABLE IF NOT EXISTS affiliate_orders (
    id                  bigserial PRIMARY KEY,
    platform            text NOT NULL,
    external_order_id   text NOT NULL,
    ordered_at          timestamptz,
    completed_at        timestamptz,
    cancelled_at        timestamptz,
    status              text NOT NULL DEFAULT 'unknown',
    product_id          text,
    product_external_id text,
    product_type        text,
    sub_id              text,
    campaign            text,
    persona_code        text,
    placement           text,
    attributed          boolean NOT NULL DEFAULT false,
    order_amount        numeric,
    currency            text,
    commission_amount   numeric,
    commission_currency text,
    import_batch_id     text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (platform, external_order_id)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_aff_orders_product ON affiliate_orders(product_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_aff_orders_status ON affiliate_orders(status)`;
});

/** 從 SubId 反解人格與版位（規格 §33）；解不出 → null（不硬塞，規格 §34）。 */
function decodeSubId(subId?: string | null): {
  personaCode: string | null;
  placement: string | null;
} {
  if (!subId) return { personaCode: null, placement: null };
  const tokens = subId.split(/[_\-:|]/).filter(Boolean);
  let personaCode: string | null = null;
  let placement: string | null = null;
  for (const t of tokens) {
    const up = t.toUpperCase();
    if (!personaCode && isPersonaCode(up)) personaCode = up;
    if (!placement) {
      // SubId 段內底線已被去掉（result_top → resulttop），比對時兩邊都去底線
      const lc = t.toLowerCase();
      const match = PLACEMENT_CODES.find((c) => c.replace(/_/g, "") === lc);
      if (match) placement = match;
    }
  }
  return { personaCode, placement };
}

async function matchProductId(
  platform: string,
  externalId?: string | null,
): Promise<string | null> {
  if (!sql || !externalId) return null;
  const rows = await sql`
    SELECT id FROM affiliate_products
    WHERE platform = ${platform} AND external_product_id = ${externalId} LIMIT 1`;
  return rows[0]?.id ?? null;
}

export interface ImportSummary {
  batchId: string | null;
  total: number;
  inserted: number;
  updated: number;
  duplicates: number;
  errors: number;
  attributed: number;
  unattributed: number;
  skippedDuplicateFile: boolean;
}

const EMPTY: ImportSummary = {
  batchId: null,
  total: 0,
  inserted: 0,
  updated: 0,
  duplicates: 0,
  errors: 0,
  attributed: 0,
  unattributed: 0,
  skippedDuplicateFile: false,
};

/** 匯入一批訂單。整檔內容相同 → 跳過（防手滑重複上傳）。 */
export async function importOrders(
  platform: string,
  orders: NormalizedOrder[],
  meta: { source?: string; rawContent?: string } = {},
): Promise<ImportSummary> {
  if (!sql) return { ...EMPTY };
  await ensureSchema();

  const contentHash = meta.rawContent
    ? createHash("sha256").update(meta.rawContent).digest("hex")
    : null;
  if (contentHash) {
    const dup = await sql`
      SELECT id FROM affiliate_import_batches WHERE content_hash = ${contentHash} LIMIT 1`;
    if (dup[0]) {
      return { ...EMPTY, total: orders.length, skippedDuplicateFile: true };
    }
  }

  const batchId = crypto.randomUUID();
  let inserted = 0,
    updated = 0,
    errors = 0,
    attributed = 0;

  for (const o of orders) {
    if (!o.externalOrderId) {
      errors++;
      continue;
    }
    const status = normalizeOrderStatus(o.statusRaw ?? "");
    const { personaCode, placement } = decodeSubId(o.subId);
    const isAttributed = !!(o.subId && o.subId.trim());
    if (isAttributed) attributed++;
    const productId = await matchProductId(platform, o.productExternalId);
    try {
      const rows = await sql`
        INSERT INTO affiliate_orders (
          platform, external_order_id, ordered_at, completed_at, cancelled_at, status,
          product_id, product_external_id, product_type, sub_id, campaign,
          persona_code, placement, attributed,
          order_amount, currency, commission_amount, commission_currency, import_batch_id
        ) VALUES (
          ${platform}, ${o.externalOrderId}, ${o.orderedAt ?? null}, ${o.completedAt ?? null},
          ${o.cancelledAt ?? null}, ${status}, ${productId}, ${o.productExternalId ?? null},
          ${o.productType ?? null}, ${o.subId ?? null}, ${o.campaign ?? null},
          ${personaCode}, ${placement}, ${isAttributed},
          ${o.orderAmount ?? null}, ${o.currency ?? null},
          ${o.commissionAmount ?? null}, ${o.commissionCurrency ?? null}, ${batchId}
        )
        ON CONFLICT (platform, external_order_id) DO UPDATE SET
          status              = EXCLUDED.status,
          completed_at        = EXCLUDED.completed_at,
          cancelled_at        = EXCLUDED.cancelled_at,
          order_amount        = EXCLUDED.order_amount,
          commission_amount   = EXCLUDED.commission_amount,
          commission_currency = EXCLUDED.commission_currency,
          product_id          = COALESCE(EXCLUDED.product_id, affiliate_orders.product_id),
          persona_code        = COALESCE(EXCLUDED.persona_code, affiliate_orders.persona_code),
          placement           = COALESCE(EXCLUDED.placement, affiliate_orders.placement),
          attributed          = affiliate_orders.attributed OR EXCLUDED.attributed,
          updated_at          = now()
        RETURNING (xmax = 0) AS inserted`;
      if (rows[0]?.inserted) inserted++;
      else updated++;
    } catch {
      errors++;
    }
  }

  const duplicates = 0; // 同檔重覆已由 content_hash 擋；批內 (platform,id) 衝突計為 updated
  await sql`
    INSERT INTO affiliate_import_batches
      (id, kind, platform, source, row_count, inserted, updated, duplicates, errors, content_hash)
    VALUES (${batchId}, 'orders', ${platform}, ${meta.source ?? null},
            ${orders.length}, ${inserted}, ${updated}, ${duplicates}, ${errors}, ${contentHash})`;

  return {
    batchId,
    total: orders.length,
    inserted,
    updated,
    duplicates,
    errors,
    attributed,
    unattributed: orders.length - attributed,
    skippedDuplicateFile: false,
  };
}

export interface ProductOrderStat {
  productId: string;
  orders: number;
  validOrders: number; // confirmed + completed
  cancelled: number;
  commission: number;
}

/** 每商品訂單統計（給收益報告）。 */
export async function productOrderStats(sinceDays = 30): Promise<Map<string, ProductOrderStat>> {
  const out = new Map<string, ProductOrderStat>();
  if (!sql) return out;
  await ensureSchema();
  const rows = await sql`
    SELECT product_id,
           COUNT(*)::int AS orders,
           COUNT(*) FILTER (WHERE status IN ('confirmed','completed'))::int AS valid,
           COUNT(*) FILTER (WHERE status IN ('cancelled','refunded'))::int AS cancelled,
           COALESCE(SUM(commission_amount) FILTER (WHERE status IN ('confirmed','completed')), 0) AS commission
    FROM affiliate_orders
    WHERE product_id IS NOT NULL
      AND created_at >= now() - (${sinceDays} || ' days')::interval
    GROUP BY product_id`;
  for (const r of rows) {
    out.set(r.product_id, {
      productId: r.product_id,
      orders: Number(r.orders),
      validOrders: Number(r.valid),
      cancelled: Number(r.cancelled),
      commission: Number(r.commission),
    });
  }
  return out;
}

/** 無法歸因訂單比例（成功指標 §16）。 */
export async function unattributedRatio(sinceDays = 30): Promise<{ total: number; unattributed: number }> {
  if (!sql) return { total: 0, unattributed: 0 };
  await ensureSchema();
  const rows = await sql`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE attributed = false)::int AS un
    FROM affiliate_orders
    WHERE created_at >= now() - (${sinceDays} || ' days')::interval`;
  return { total: Number(rows[0]?.total ?? 0), unattributed: Number(rows[0]?.un ?? 0) };
}
