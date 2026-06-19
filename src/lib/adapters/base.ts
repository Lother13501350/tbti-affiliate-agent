import { pick, type CsvRow } from "../csv";
import type { NormalizedOrder } from "./types";

// Adapter 共用工具：金額解析、訂單列對映。各平台報表欄名不同 → 用候選欄名清單容錯。

/** 解析金額字串："1,234.50" / "NT$1,234" / "JPY 1234" → 1234.5；解不出 → null。 */
export function money(v: string | null | undefined): number | null {
  if (v == null) return null;
  const cleaned = String(v).replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export interface OrderCandidates {
  externalOrderId: string[];
  orderedAt: string[];
  completedAt: string[];
  cancelledAt: string[];
  status: string[];
  productExternalId: string[];
  productType: string[];
  subId: string[];
  campaign: string[];
  orderAmount: string[];
  currency: string[];
  commissionAmount: string[];
  commissionCurrency: string[];
}

// 預設候選欄名（中英混合，依實際下載報表再微調）。
export const DEFAULT_CANDIDATES: OrderCandidates = {
  externalOrderId: ["order id", "order no", "order number", "booking id", "booking no", "reference", "ref no", "訂單編號", "訂單號", "預訂編號"],
  orderedAt: ["order date", "booking date", "created at", "created", "purchase date", "下單時間", "訂單日期", "預訂日期"],
  completedAt: ["completed date", "complete date", "use date", "used date", "travel date", "completed at", "完成時間", "使用日期", "出遊日期"],
  cancelledAt: ["cancelled date", "canceled date", "cancel date", "取消時間", "取消日期"],
  status: ["status", "order status", "booking status", "狀態", "訂單狀態"],
  productExternalId: ["product id", "activity id", "sku", "item id", "商品編號", "產品編號", "活動編號"],
  productType: ["product type", "category", "type", "類型", "商品類型"],
  subId: ["sub id", "subid", "sub_id", "ud1", "aff_sub", "affiliate sub", "tracking id", "s1", "子追蹤碼"],
  campaign: ["campaign", "campaign id", "cid", "campaign name"],
  orderAmount: ["amount", "order amount", "gmv", "total", "total amount", "金額", "訂單金額", "成交金額"],
  currency: ["currency", "ccy", "幣別", "貨幣"],
  commissionAmount: ["commission", "commission amount", "est. commission", "estimated commission", "佣金", "分潤", "預估佣金"],
  commissionCurrency: ["commission currency", "佣金幣別"],
};

/** 把一批 CSV 列依候選欄名對映成統一訂單。沒有訂單編號的列略過。 */
export function parseOrderRows(
  rows: CsvRow[],
  candidates: OrderCandidates = DEFAULT_CANDIDATES,
): NormalizedOrder[] {
  const out: NormalizedOrder[] = [];
  for (const row of rows) {
    const externalOrderId = pick(row, candidates.externalOrderId);
    if (!externalOrderId) continue;
    out.push({
      externalOrderId,
      orderedAt: pick(row, candidates.orderedAt) || null,
      completedAt: pick(row, candidates.completedAt) || null,
      cancelledAt: pick(row, candidates.cancelledAt) || null,
      statusRaw: pick(row, candidates.status) || null,
      productExternalId: pick(row, candidates.productExternalId) || null,
      productType: pick(row, candidates.productType) || null,
      subId: pick(row, candidates.subId) || null,
      campaign: pick(row, candidates.campaign) || null,
      orderAmount: money(pick(row, candidates.orderAmount)),
      currency: pick(row, candidates.currency) || null,
      commissionAmount: money(pick(row, candidates.commissionAmount)),
      commissionCurrency: pick(row, candidates.commissionCurrency) || null,
    });
  }
  return out;
}

/** 在網址 query 設一個參數（找不到 / 非法 URL → 原樣回傳，絕不擋）。 */
export function setParam(url: string, key: string, value: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set(key, value);
    return u.toString();
  } catch {
    return url;
  }
}

/** 從路徑抓第一個符合 regex 的群組（商品 id）。 */
export function idFromPath(url: string, re: RegExp): string | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(re);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}
