import type { PlatformAdapter, PartialProduct } from "./types";
import { parseOrderRows, setParam, idFromPath } from "./base";

// Klook。SubId 參數依實際聯盟網路（Klook Affiliate / Partnerize）而定；
// MVP 先用 sub_id，待接上正式聯盟方案後在此一處調整即可（不影響其他平台）。
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
