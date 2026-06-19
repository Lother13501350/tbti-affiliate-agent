import { listActiveForCheck, setStatus, touchChecked } from "./products";
import { listLinksForProduct } from "./links";
import { audit } from "./audit";

// 連結健康檢查（規格 §21-25）：HTTP 狀態 + 追蹤參數是否遺失。
// apply=false（kill switch 關）→ 只回報、不改狀態（規格 §25 先發警報再人工確認）。

async function probe(url: string): Promise<{ status: number; ok: boolean }> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "user-agent": "TBTI-AffiliateAgent/1.0 (+healthcheck)" },
    });
    clearTimeout(timer);
    return { status: res.status, ok: res.status >= 200 && res.status < 400 };
  } catch {
    return { status: 0, ok: false }; // timeout / DNS / network → 視為失效
  }
}

/** 各平台聯盟連結應帶的追蹤參數（規格 §22）。 */
function expectedParam(platform: string): string {
  return platform === "kkday" ? "ud1" : "sub_id";
}

export interface HealthIssue {
  productId: string;
  code: string | null;
  platform: string;
  url: string;
  status: number;
  kind: "broken" | "param_loss";
}

export interface HealthSummary {
  checked: number;
  broken: HealthIssue[];
  paramLoss: HealthIssue[];
}

export async function runHealthCheck(opts: { apply: boolean; limit?: number }): Promise<HealthSummary> {
  const products = await listActiveForCheck(opts.limit ?? 100);
  const broken: HealthIssue[] = [];
  const paramLoss: HealthIssue[] = [];
  let checked = 0;

  for (const p of products) {
    const links = await listLinksForProduct(p.id);
    // 有連結 → 檢查每條 target_url；沒連結 → 退而檢查商品/分潤網址
    const targets: { code: string | null; url: string }[] = links.length
      ? links.map((l) => ({ code: l.code, url: l.targetUrl }))
      : [{ code: null, url: p.affiliateUrl ?? p.productUrl ?? "" }];

    for (const t of targets) {
      if (!t.url) continue;
      checked++;
      // 參數遺失：我們自己組的 target_url 是否帶該平台應有的追蹤參數
      const param = expectedParam(p.platform);
      if (!new RegExp(`[?&]${param}=`).test(t.url)) {
        paramLoss.push({ productId: p.id, code: t.code, platform: p.platform, url: t.url, status: 0, kind: "param_loss" });
      }
      const r = await probe(t.url);
      if (!r.ok) {
        broken.push({ productId: p.id, code: t.code, platform: p.platform, url: t.url, status: r.status, kind: "broken" });
        if (opts.apply) {
          await setStatus(p.id, "broken");
          await audit({
            entityType: "product",
            entityId: p.id,
            action: "health_broken",
            actor: "cron",
            before: { status: p.status },
            after: { status: "broken", httpStatus: r.status },
            reason: `health check failed (HTTP ${r.status})`,
          });
        }
      }
    }
    if (opts.apply) await touchChecked(p.id);
  }

  return { checked, broken, paramLoss };
}
