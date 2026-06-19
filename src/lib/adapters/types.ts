// 平台 Adapter 介面（規格 §1,3,5,12,13,30）。每平台獨立實作，互不影響。

export type PlatformId = "klook" | "kkday" | "trip" | "other";

/** best-effort 抽到的商品資訊；抓不到的欄位留空並由 caller 設 needs_review。 */
export interface PartialProduct {
  platform: PlatformId;
  externalProductId: string | null;
  productName: string | null;
  productUrl: string;
  countryCode: string | null;
  city: string | null;
  category: string | null;
  /** 有任何關鍵欄位抓不到（名稱/價格/城市…）→ true。絕不捏造價格/評分（規格 §3）。 */
  needsReview: boolean;
}

export interface SubIdParts {
  persona?: string | null;
  dest?: string | null;
  placement?: string | null;
  variant?: string | null;
}

/** 統一訂單（adapter.parseOrderReport 的輸出 → orders.importOrders 的輸入）。 */
export interface NormalizedOrder {
  externalOrderId: string;
  orderedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  statusRaw?: string | null;
  productExternalId?: string | null;
  productType?: string | null;
  subId?: string | null;
  campaign?: string | null;
  orderAmount?: number | null;
  currency?: string | null;
  commissionAmount?: number | null;
  commissionCurrency?: string | null;
}

export interface PlatformAdapter {
  id: PlatformId;
  label: string;
  /** 網址是否屬於本平台（規格 §2 自動辨識）。 */
  detect(url: string): boolean;
  /** 從網址 best-effort 抽欄位（MVP 不抓遠端 HTML，僅解析 URL）。 */
  extract(url: string): PartialProduct;
  /** 把 SubId 接到聯盟連結（KKday=ud1；其餘平台依各自參數）。 */
  appendSubId(affiliateUrl: string, subId: string): string;
  /** 解析該平台訂單報表（CSV 物件列）→ 統一訂單。 */
  parseOrderReport(rows: Record<string, string>[]): NormalizedOrder[];
}
