import { CRON_SECRET, IS_PROD, AGENT_WRITE_ENABLED } from "@/lib/env";
import { runHealthCheck } from "@/lib/health";
import { overviewMetrics } from "@/lib/revenue";
import { postDiscord, money, pct } from "@/lib/discord";

// 每日管線（規格 §14 的 MVP 子集）：健康檢查 → 算指標 → Discord 日報 + 失效警報。
// Vercel Cron 會自動帶 Authorization: Bearer <CRON_SECRET>。
export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  if (!CRON_SECRET) return !IS_PROD; // 沒設 secret：dev 放行、prod 拒絕
  return (req.headers.get("authorization") ?? "") === `Bearer ${CRON_SECRET}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 403 });
  }

  // 1) 連結健康檢查（kill switch 關 → 只回報不改狀態）
  const health = await runHealthCheck({ apply: AGENT_WRITE_ENABLED, limit: 100 });

  // 2) 指標
  const m = await overviewMetrics();

  // 3) 日報
  const lines = [
    "**TBTI 聯盟商品日報**",
    `昨日點擊 ${m.clicksYesterday}・近 7 日 ${m.clicks7d}`,
    `近 30 日 訂單 ${m.orders30d}（有效 ${m.validOrders30d}）・佣金 ${money(m.commission30d)}・EPC ${money(m.epc30d)}`,
    `待審核 ${m.pendingReview}・連結失效率 ${pct(m.brokenRate)}・無法歸因 ${m.unattributed.unattributed}/${m.unattributed.total}`,
  ];
  if (m.topProducts.length) {
    lines.push("— Top 商品（近 30 日）—");
    for (const r of m.topProducts.slice(0, 5)) {
      lines.push(`・${r.name}：點 ${r.clicks} / 有效訂 ${r.validOrders} / 佣 ${money(r.commission)}`);
    }
  }
  await postDiscord(lines.join("\n"));

  // 4) 失效 / 參數遺失警報（規格 §48）
  if (health.broken.length) {
    const note = AGENT_WRITE_ENABLED
      ? "（已標記 broken、停曝光）"
      : "（唯讀模式：僅回報，未改狀態）";
    const alert = [
      `連結失效 ${health.broken.length} 條 ${note}`,
      ...health.broken.slice(0, 10).map((b) => `・${b.platform} ${b.productId} HTTP ${b.status}`),
    ].join("\n");
    await postDiscord(alert, { alert: true });
  }
  if (health.paramLoss.length) {
    await postDiscord(
      `分潤參數遺失 ${health.paramLoss.length} 條（請檢查 SubId 組裝）`,
      { alert: true },
    );
  }

  return Response.json({
    ok: true,
    writeEnabled: AGENT_WRITE_ENABLED,
    health: {
      checked: health.checked,
      broken: health.broken.length,
      paramLoss: health.paramLoss.length,
    },
    metrics: { clicksYesterday: m.clicksYesterday, commission30d: m.commission30d },
  });
}
