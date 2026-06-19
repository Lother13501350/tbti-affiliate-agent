// 商品分類與生命週期詞彙（規格 §5,6,9,10,30,31）。code 入庫、label 顯示。

export const CATEGORIES = [
  { code: "flight", label: "機票" },
  { code: "hotel", label: "飯店" },
  { code: "flight_hotel", label: "機加酒" },
  { code: "attraction", label: "景點門票" },
  { code: "experience", label: "當地體驗" },
  { code: "day_tour", label: "一日遊" },
  { code: "multi_day_tour", label: "多日遊" },
  { code: "transport_pass", label: "交通票券" },
  { code: "airport_transfer", label: "機場接送" },
  { code: "car_rental", label: "租車" },
  { code: "esim", label: "eSIM" },
  { code: "wifi", label: "Wi-Fi" },
  { code: "meal_voucher", label: "餐券" },
  { code: "cruise", label: "郵輪" },
  { code: "other", label: "其他" },
] as const;
export type CategoryCode = (typeof CATEGORIES)[number]["code"];
export const CATEGORY_CODES: readonly string[] = CATEGORIES.map((c) => c.code);

// 商品生命週期（規格 §6）。canDisplay = 是否可在站上曝光。
export const PRODUCT_STATUSES = [
  { code: "draft", label: "草稿", canDisplay: false },
  { code: "pending_review", label: "待審核", canDisplay: false },
  { code: "active", label: "可顯示", canDisplay: true },
  { code: "paused", label: "暫停推薦", canDisplay: false },
  { code: "expired", label: "已過期", canDisplay: false },
  { code: "broken", label: "連結失效", canDisplay: false },
  { code: "sold_out", label: "暫無法購買", canDisplay: false },
  { code: "rejected", label: "不適合 TBTI", canDisplay: false },
  { code: "archived", label: "封存", canDisplay: false },
] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number]["code"];
export const PRODUCT_STATUS_CODES = PRODUCT_STATUSES.map((s) => s.code);
export const DISPLAYABLE_STATUSES = PRODUCT_STATUSES.filter((s) => s.canDisplay).map((s) => s.code);

// 使用情境 / 旅行階段（規格 §9）
export const SCENARIOS = [
  { code: "inspiration", label: "靈感探索" },
  { code: "planning", label: "規劃行程" },
  { code: "book_flight", label: "訂機票" },
  { code: "book_stay", label: "訂住宿" },
  { code: "pre_trip", label: "行前準備" },
  { code: "arrival_transport", label: "抵達交通" },
  { code: "in_destination", label: "當地活動" },
  { code: "impulse", label: "旅途中臨時購買" },
] as const;
export const SCENARIO_CODES: readonly string[] = SCENARIOS.map((s) => s.code);

// 預算級距（規格 §10）
export const BUDGET_TIERS = [
  { code: "ultra_low", label: "超低預算" },
  { code: "low", label: "平價" },
  { code: "mid", label: "中等" },
  { code: "high", label: "高價" },
  { code: "luxury", label: "奢華" },
] as const;
export const BUDGET_TIER_CODES: readonly string[] = BUDGET_TIERS.map((b) => b.code);

// 客群（規格 §10）
export const AUDIENCES = [
  { code: "solo", label: "單人" },
  { code: "couple", label: "情侶" },
  { code: "family", label: "家庭" },
  { code: "friends", label: "朋友團體" },
  { code: "corporate", label: "公司團體" },
  { code: "parent_child", label: "親子" },
  { code: "elder_friendly", label: "長輩友善" },
] as const;
export const AUDIENCE_CODES: readonly string[] = AUDIENCES.map((a) => a.code);

// 站內版位（決定 SubId 的 placement 段，規格 §13,14）
export const PLACEMENTS = [
  { code: "result_top", label: "結果頁置頂" },
  { code: "result_list", label: "結果頁清單" },
  { code: "feed_card", label: "Explore 卡片" },
  { code: "persona_page", label: "人格頁" },
  { code: "article", label: "文章內" },
  { code: "email", label: "Email 再行銷" },
  { code: "other", label: "其他" },
] as const;
export const PLACEMENT_CODES: readonly string[] = PLACEMENTS.map((p) => p.code);

// 訂單狀態（規格 §31）
export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "refunded",
  "rejected",
  "unknown",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** 把各平台原始狀態字串正規化成統一狀態。 */
export function normalizeOrderStatus(raw: string): OrderStatus {
  const s = raw.trim().toLowerCase();
  if (!s) return "unknown";
  if (/(complete|completed|fulfilled|settled|結算|已完成|完成)/.test(s)) return "completed";
  if (/(confirm|confirmed|valid|已確認|確認|有效)/.test(s)) return "confirmed";
  if (/(refund|退款|退費)/.test(s)) return "refunded";
  if (/(cancel|cancelled|canceled|void|取消)/.test(s)) return "cancelled";
  if (/(reject|declined|invalid|拒絕|無效)/.test(s)) return "rejected";
  if (/(pending|processing|待|處理中|未確認)/.test(s)) return "pending";
  return "unknown";
}

export function labelOf<T extends { code: string; label: string }>(
  list: readonly T[],
  code: string | null | undefined,
): string {
  if (!code) return "";
  return list.find((x) => x.code === code)?.label ?? code;
}
