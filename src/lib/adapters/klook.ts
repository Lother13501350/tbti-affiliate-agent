import type { PlatformAdapter, PartialProduct } from "./types";
import { parseOrderRows, setParam, idFromPath } from "./base";

// Klook。SubId 走「自訂標籤」參數 aff_label1（已用 Klook 連結轉換器驗證）。
// 之後若要 aff_label2/3 可在此擴充，不影響其他平台。
export const klookAdapter: PlatformAdapter = {
  id: "klook",
  label: "Klook",
  detect(url) {
    return /(^|\.)klook\.com/i.test(safeHost(url));
  },
  extract(url): PartialProduct {
    // 活動頁形如 /activity/12345-some-slug/；id = 12345
    const externalProductId = idFromPath(url, /\/activity\/(\d+)/);
    return {
      platform: "klook",
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
    return setParam(affiliateUrl, "aff_label1", subId);
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
