import { sql, once } from "./db";
import { prepareOrderImport, preparedImportHash } from "./workflows";
import { ORDER_IMPORT_SQL } from "./workflow-sql";
import { ensureProductSchema } from "./products";
import type { NormalizedOrder } from "./adapters/types";

// affiliate_orders + affiliate_import_batches（規格 §29-34）。
// 防重複匯入：整檔 content_hash 去重 + 每筆 (platform, external_order_id) 唯一去重。

export const BATCH_TABLE_SQL = `CREATE TABLE IF NOT EXISTS affiliate_import_batches (
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
export const ORDER_TABLE_SQL = `CREATE TABLE IF NOT EXISTS affiliate_orders (
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

const ensureSchema = once(async () => {
  if (!sql) return;
  await ensureProductSchema();
  await sql.query(BATCH_TABLE_SQL);
  await sql`CREATE INDEX IF NOT EXISTS idx_aff_batches_hash ON affiliate_import_batches(content_hash)`;
  await sql.query(ORDER_TABLE_SQL);
  await sql`CREATE INDEX IF NOT EXISTS idx_aff_orders_product ON affiliate_orders(product_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_aff_orders_status ON affiliate_orders(status)`;
  await sql.query(ORDER_IMPORT_SQL);
});

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

  const prepared = prepareOrderImport(platform, orders, meta.rawContent);
  const rows = await sql.query(
    "SELECT affiliate_import_orders($1,$2::jsonb,$3,$4,$5) result",
    [
      platform,
      JSON.stringify(prepared),
      preparedImportHash(platform, meta.rawContent),
      crypto.randomUUID(),
      meta.source ?? null,
    ],
  );
  return rows[0].result as ImportSummary;
}

export interface ProductOrderStat {
  productId: string;
  orders: number;
  validOrders: number; // confirmed + completed
  cancelled: number;
  commission: number;
}

/** 每商品訂單統計（給收益報告）。 */
export async function productOrderStats(
  sinceDays = 30,
): Promise<Map<string, ProductOrderStat>> {
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
export async function unattributedRatio(
  sinceDays = 30,
): Promise<{ total: number; unattributed: number }> {
  if (!sql) return { total: 0, unattributed: 0 };
  await ensureSchema();
  const rows = await sql`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE attributed = false)::int AS un
    FROM affiliate_orders
    WHERE created_at >= now() - (${sinceDays} || ' days')::interval`;
  return {
    total: Number(rows[0]?.total ?? 0),
    unattributed: Number(rows[0]?.un ?? 0),
  };
}
