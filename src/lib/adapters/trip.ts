import type { PlatformAdapter, PartialProduct } from "./types";
import { parseOrderRows, setParam, idFromPath } from "./base";

// Trip.com。SubId 參數依實際聯盟方案（Trip.com Affiliate / Partnerize）而定；
// MVP 先用 sub_id，正式接上後在此調整。
export const tripAdapter: PlatformAdapter = {
  id: "trip",
  label: "Trip.com",
  detect(url) {
    return /(^|\.)trip\.com/i.test(safeHost(url));
  },
  extract(url): PartialProduct {
    // 形態多樣（hotels / things-to-do / flights）；best-effort 抓路徑中第一個長數字 id。
    const externalProductId =
      idFromPath(url, /detail\/(\d+)/) ?? idFromPath(url, /\/(\d{5,})/);
    return {
      platform: "trip",
      externalProductId,
      productName: null,
      productUrl: url,
      countryCode: null,
      city: null,
      category: null,
      needsReview: true,
    };
  },
  appendSubId(affiliateUrl, subId) {
    return setParam(affiliateUrl, "sub_id", subId);
  },
  parseOrderReport(rows) {
    return parseOrderRows(rows);
  },
};

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}
