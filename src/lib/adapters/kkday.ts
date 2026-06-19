import type { PlatformAdapter, PartialProduct } from "./types";
import { parseOrderRows, setParam, idFromPath, type OrderCandidates, DEFAULT_CANDIDATES } from "./base";

// KKday。聯盟歸因用 ud1（主站既有試水溫卡即用 ud1=TBTI；本 Agent 改帶情境化 SubId）。
const CANDIDATES: OrderCandidates = {
  ...DEFAULT_CANDIDATES,
  subId: ["ud1", "sub id", "subid", "sub_id", "子追蹤碼"],
};

export const kkdayAdapter: PlatformAdapter = {
  id: "kkday",
  label: "KKday",
  detect(url) {
    return /(^|\.)kkday\.com/i.test(safeHost(url));
  },
  extract(url): PartialProduct {
    // 商品頁形如 /zh-tw/product/135223-tokyo-...；id = 135223
    const externalProductId = idFromPath(url, /\/product\/(\d+)/);
    return {
      platform: "kkday",
      externalProductId,
      productName: null, // MVP 不抓遠端 HTML → 留待人工/平台報表補
      productUrl: url,
      countryCode: null,
      city: null,
      category: null,
      needsReview: true, // 名稱/價格/城市未抽 → 一律進審核
    };
  },
  appendSubId(affiliateUrl, subId) {
    return setParam(affiliateUrl, "ud1", subId); // 保留 cid，覆蓋 ud1 為情境化 SubId
  },
  parseOrderReport(rows) {
    return parseOrderRows(rows, CANDIDATES);
  },
};

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}
