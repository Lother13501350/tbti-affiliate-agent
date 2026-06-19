import type { PlatformAdapter, PartialProduct } from "./types";
import { parseOrderRows, setParam } from "./base";

// 一般網址 fallback（規格 §2「未知平台 / 不含分潤追蹤」）。detect 永遠 true → 當註冊表最後一個。
export const genericAdapter: PlatformAdapter = {
  id: "other",
  label: "其他 / 未知平台",
  detect() {
    return true;
  },
  extract(url): PartialProduct {
    return {
      platform: "other",
      externalProductId: null,
      productName: null,
      productUrl: url,
      countryCode: null,
      city: null,
      category: null,
      needsReview: true,
    };
  },
  appendSubId(affiliateUrl, subId) {
    return setParam(affiliateUrl, "sub_id", subId); // best-effort；未知平台未必支援
  },
  parseOrderReport(rows) {
    return parseOrderRows(rows);
  },
};
