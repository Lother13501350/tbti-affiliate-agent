import { sql } from "./db";
import { productClickStats, totalClicks } from "./clicks";
import { productOrderStats, unattributedRatio } from "./orders";
import { statusCounts } from "./products";

// 商品收益報告（規格 §35）：合併點擊與訂單，算 CTR→訂單轉換、EPC、取消率。

export interface RevRow {
  id: string;
  name: string;
  platform: string;
  status: string;
  city: string | null;
  category: string | null;
  clicks: number;
  uniqueClicks: number;
  orders: number;
  validOrders: number;
  cancelled: number;
  commission: number;
  conversion: number; // validOrders / uniqueClicks
  epc: number; // commission / clicks
  cancelRate: number; // cancelled / orders
}

export async function productRevenue(sinceDays = 30): Promise<RevRow[]> {
  if (!sql) return [];
  const [clickMap, orderMap] = await Promise.all([
    productClickStats(sinceDays),
    productOrderStats(sinceDays),
  ]);
  const ids = [...new Set([...clickMap.keys(), ...orderMap.keys()])];
  if (ids.length === 0) return [];

  const infoRows = await sql`
    SELECT id, product_name, platform, status, city, category
    FROM affiliate_products
    WHERE id IN (SELECT jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb))`;
  const info = new Map(infoRows.map((r) => [r.id, r]));

  const rows: RevRow[] = ids.map((id) => {
    const c = clickMap.get(id);
    const o = orderMap.get(id);
    const i = info.get(id);
    const clicks = c?.raw ?? 0;
    const uniqueClicks = c?.uniqueSessions ?? 0;
    const orders = o?.orders ?? 0;
    const validOrders = o?.validOrders ?? 0;
    const cancelled = o?.cancelled ?? 0;
    const commission = o?.commission ?? 0;
    return {
      id,
      name: i?.product_name ?? id,
      platform: i?.platform ?? "",
      status: i?.status ?? "",
      city: i?.city ?? null,
      category: i?.category ?? null,
      clicks,
      uniqueClicks,
      orders,
      validOrders,
      cancelled,
      commission,
      conversion: uniqueClicks > 0 ? validOrders / uniqueClicks : 0,
      epc: clicks > 0 ? commission / clicks : 0,
      cancelRate: orders > 0 ? cancelled / orders : 0,
    };
  });
  rows.sort((a, b) => b.commission - a.commission || b.clicks - a.clicks);
  return rows;
}

// 後台首頁成功指標（規格 §16）
export interface Overview {
  clicks7d: number;
  clicksYesterday: number;
  orders30d: number;
  validOrders30d: number;
  commission30d: number;
  epc30d: number;
  unattributed: { total: number; unattributed: number };
  statusCounts: Record<string, number>;
  brokenRate: number;
  pendingReview: number;
  topProducts: RevRow[];
}

export async function overviewMetrics(): Promise<Overview> {
  const [clicks7d, clicksYesterday, statuses, unattributed, rev] = await Promise.all([
    totalClicks(7),
    totalClicks(1),
    statusCounts(),
    unattributedRatio(30),
    productRevenue(30),
  ]);
  const commission30d = rev.reduce((s, r) => s + r.commission, 0);
  const orders30d = rev.reduce((s, r) => s + r.orders, 0);
  const validOrders30d = rev.reduce((s, r) => s + r.validOrders, 0);
  const clicksOnProducts = rev.reduce((s, r) => s + r.clicks, 0);
  const active = statuses["active"] ?? 0;
  const broken = statuses["broken"] ?? 0;
  return {
    clicks7d,
    clicksYesterday,
    orders30d,
    validOrders30d,
    commission30d,
    epc30d: clicksOnProducts > 0 ? commission30d / clicksOnProducts : 0,
    unattributed,
    statusCounts: statuses,
    brokenRate: active + broken > 0 ? broken / (active + broken) : 0,
    pendingReview: statuses["pending_review"] ?? 0,
    topProducts: rev.slice(0, 10),
  };
}
