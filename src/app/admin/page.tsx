import { notFound } from "next/navigation";
import { isAdminKey } from "@/lib/admin-auth";
import { dbEnabled } from "@/lib/env";
import { overviewMetrics } from "@/lib/revenue";
import { PRODUCT_STATUSES, labelOf } from "@/lib/taxonomy";
import { AdminNav } from "./AdminNav";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

type SP = Promise<{ [k: string]: string | string[] | undefined }>;

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-neutral-400">{sub}</div> : null}
    </div>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const key = typeof sp.key === "string" ? sp.key : "";
  if (!isAdminKey(key)) notFound();

  const m = await overviewMetrics();

  return (
    <>
      <AdminNav adminKey={key} active="dashboard" />
      <main className="mx-auto max-w-6xl px-4 py-6">
        {!dbEnabled && (
          <div className="card mb-4 border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40">
            未設定 <code>DATABASE_URL</code> — 以下數字為 0。設定後即時生效。
          </div>
        )}

        <h1 className="mb-3 text-lg font-bold">成功指標（規格 §16）</h1>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="昨日點擊" value={fmt(m.clicksYesterday)} sub={`近 7 日 ${fmt(m.clicks7d)}`} />
          <Metric label="近 30 日佣金" value={fmt(m.commission30d)} sub={`EPC ${fmt(m.epc30d)}`} />
          <Metric label="有效訂單 / 訂單" value={`${fmt(m.validOrders30d)} / ${fmt(m.orders30d)}`} sub="近 30 日" />
          <Metric label="連結失效率" value={`${(m.brokenRate * 100).toFixed(1)}%`} sub={`待審核 ${m.pendingReview}`} />
          <Metric
            label="無法歸因訂單"
            value={`${m.unattributed.unattributed} / ${m.unattributed.total}`}
            sub="近 30 日"
          />
        </div>

        <h2 className="mb-2 mt-6 text-sm font-semibold text-neutral-500">各狀態商品數</h2>
        <div className="flex flex-wrap gap-2">
          {PRODUCT_STATUSES.map((s) => (
            <span key={s.code} className="card px-3 py-1.5 text-sm">
              {s.label}
              <span className="ml-2 font-bold tabular-nums">{m.statusCounts[s.code] ?? 0}</span>
            </span>
          ))}
        </div>

        <h2 className="mb-2 mt-6 text-sm font-semibold text-neutral-500">Top 商品（近 30 日）</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-neutral-500">
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                <th className="p-2">商品</th>
                <th className="p-2">平台</th>
                <th className="p-2 text-right">點擊</th>
                <th className="p-2 text-right">有效訂單</th>
                <th className="p-2 text-right">轉換</th>
                <th className="p-2 text-right">佣金</th>
                <th className="p-2 text-right">EPC</th>
              </tr>
            </thead>
            <tbody>
              {m.topProducts.length === 0 && (
                <tr>
                  <td className="p-3 text-neutral-400" colSpan={7}>
                    尚無點擊 / 訂單資料。
                  </td>
                </tr>
              )}
              {m.topProducts.map((r) => (
                <tr key={r.id} className="border-b border-neutral-100 dark:border-neutral-900">
                  <td className="p-2">{r.name}</td>
                  <td className="p-2 text-neutral-500">{r.platform}</td>
                  <td className="p-2 text-right tabular-nums">{r.clicks}</td>
                  <td className="p-2 text-right tabular-nums">{r.validOrders}</td>
                  <td className="p-2 text-right tabular-nums">{(r.conversion * 100).toFixed(1)}%</td>
                  <td className="p-2 text-right tabular-nums">{fmt(r.commission)}</td>
                  <td className="p-2 text-right tabular-nums">{fmt(r.epc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-neutral-400">
          狀態詞彙：{PRODUCT_STATUSES.map((s) => labelOf(PRODUCT_STATUSES, s.code)).join("・")}
        </p>
      </main>
    </>
  );
}
