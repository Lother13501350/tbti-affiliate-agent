import { notFound } from "next/navigation";
import { isAdminKey } from "@/lib/admin-auth";
import { dbEnabled } from "@/lib/env";
import { findGaps } from "@/lib/gaps";
import { TAGGABLE_PERSONAS } from "@/lib/personas";
import { AdminNav } from "../AdminNav";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SP = Promise<{ [k: string]: string | string[] | undefined }>;

export default async function GapsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const key = typeof sp.key === "string" ? sp.key : "";
  if (!isAdminKey(key)) notFound();

  const { cities, gaps, coverage } = await findGaps({ minPerCombo: 2 });
  const cov = new Map(coverage.map((c) => [`${c.persona}|${c.city}`, c.count]));

  function cell(n: number) {
    if (n === 0) return "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300";
    if (n < 2) return "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300";
    return "text-neutral-600 dark:text-neutral-300";
  }

  return (
    <>
      <AdminNav adminKey={key} active="gaps" />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <h1 className="text-lg font-bold">商品缺口（§41）</h1>
        <p className="text-sm text-neutral-500">
          以 active 商品最熱門的城市 × 可鎖定人格做覆蓋矩陣。<span className="rounded bg-red-100 px-1 dark:bg-red-950/50">紅 = 0</span>、
          <span className="rounded bg-amber-100 px-1 dark:bg-amber-950/50">黃 = 1</span> 即缺口，優先補貨。
        </p>

        {!dbEnabled && (
          <div className="card border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40">
            未設定 <code>DATABASE_URL</code>。
          </div>
        )}

        {cities.length === 0 ? (
          <div className="card p-6 text-center text-sm text-neutral-400">尚無 active 商品（或商品沒填城市）。</div>
        ) : (
          <>
            <div className="card overflow-x-auto">
              <table className="text-xs">
                <thead>
                  <tr className="text-neutral-500">
                    <th className="sticky left-0 bg-white p-2 text-left dark:bg-neutral-950">人格 \ 城市</th>
                    {cities.map((c) => (
                      <th key={c} className="p-2 text-center font-medium">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TAGGABLE_PERSONAS.map((p) => (
                    <tr key={p.code} className="border-t border-neutral-100 dark:border-neutral-900">
                      <td className="sticky left-0 bg-white p-2 font-medium dark:bg-neutral-950" title={p.title}>{p.code}</td>
                      {cities.map((c) => {
                        const n = cov.get(`${p.code}|${c}`) ?? 0;
                        return (
                          <td key={c} className={`p-2 text-center tabular-nums ${cell(n)}`}>{n}</td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="text-sm font-semibold text-neutral-500">優先補貨清單（0 商品的組合）</h2>
            <div className="flex flex-wrap gap-1.5">
              {gaps.filter((g) => g.count === 0).slice(0, 60).map((g) => (
                <span key={`${g.persona}|${g.city}`} className="card px-2 py-1 text-xs">
                  {g.persona} × {g.city}
                </span>
              ))}
              {gaps.filter((g) => g.count === 0).length === 0 && (
                <span className="text-sm text-neutral-400">熱門城市都至少有 1 個對應人格商品 🎉</span>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}
