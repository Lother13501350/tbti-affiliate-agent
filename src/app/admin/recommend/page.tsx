import { notFound } from "next/navigation";
import { isAdminKey } from "@/lib/admin-auth";
import { recommendProducts } from "@/lib/recommend";
import { TAGGABLE_PERSONAS, personaTitle } from "@/lib/personas";
import { AdminNav } from "../AdminNav";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SP = Promise<{ [k: string]: string | string[] | undefined }>;
const s = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function RecommendPreview({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const key = s(sp.key) ?? "";
  if (!isAdminKey(key)) notFound();

  const persona = s(sp.persona) ?? "";
  const city = s(sp.city) ?? "";
  const recs = await recommendProducts({
    persona: persona || null,
    city: city || null,
    limit: 20,
  });

  return (
    <>
      <AdminNav adminKey={key} active="recommend" />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <h1 className="text-lg font-bold">推薦預覽（§17 決定論排序）</h1>
        <p className="text-sm text-neutral-500">
          公式：人格 25% ＋ 目的地 25% ＋ CTR 15% ＋ 轉換 15% ＋ 佣金 10% ＋ 新鮮度 5% ＋ 人工 5%。佣金非唯一因子，並做多樣性控制。
        </p>

        <form method="get" className="card flex flex-wrap items-end gap-2 p-3 text-sm">
          <input type="hidden" name="key" value={key} />
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500">人格</span>
            <select name="persona" defaultValue={persona} className="rounded border border-neutral-300 px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900">
              <option value="">（不指定）</option>
              {TAGGABLE_PERSONAS.map((p) => (
                <option key={p.code} value={p.code}>{p.code} {p.title}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500">城市</span>
            <input name="city" defaultValue={city} placeholder="osaka" className="rounded border border-neutral-300 px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900" />
          </label>
          <button className="rounded bg-neutral-900 px-3 py-1.5 font-semibold text-white dark:bg-white dark:text-neutral-900">預覽排序</button>
          {persona && <span className="self-center text-xs text-neutral-400">鎖定：{personaTitle(persona)}</span>}
        </form>

        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-neutral-500">
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                <th className="p-2">#</th>
                <th className="p-2">商品</th>
                <th className="p-2">平台</th>
                <th className="p-2">城市</th>
                <th className="p-2 text-right">總分</th>
                <th className="p-2 text-right">人格</th>
                <th className="p-2 text-right">目的地</th>
                <th className="p-2 text-right">轉換</th>
                <th className="p-2 text-right">佣金</th>
                <th className="p-2">/go</th>
              </tr>
            </thead>
            <tbody>
              {recs.length === 0 && (
                <tr>
                  <td className="p-3 text-neutral-400" colSpan={10}>沒有 active 商品可排序（先在「審核佇列」把商品上架）。</td>
                </tr>
              )}
              {recs.map((r, i) => (
                <tr key={r.product.id} className="border-b border-neutral-100 dark:border-neutral-900">
                  <td className="p-2 text-neutral-400">{i + 1}</td>
                  <td className="p-2 font-medium">{r.product.productName}</td>
                  <td className="p-2 text-neutral-500">{r.product.platform}</td>
                  <td className="p-2">{r.product.city ?? "—"}</td>
                  <td className="p-2 text-right font-bold tabular-nums">{r.score.toFixed(3)}</td>
                  <td className="p-2 text-right tabular-nums text-neutral-500">{r.breakdown.persona.toFixed(2)}</td>
                  <td className="p-2 text-right tabular-nums text-neutral-500">{r.breakdown.dest.toFixed(2)}</td>
                  <td className="p-2 text-right tabular-nums text-neutral-500">{r.breakdown.conversion.toFixed(2)}</td>
                  <td className="p-2 text-right tabular-nums text-neutral-500">{r.breakdown.commission.toFixed(2)}</td>
                  <td className="p-2">
                    {r.goCode ? (
                      <a href={`/go/${r.goCode}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">/go/{r.goCode}</a>
                    ) : (
                      <span className="text-neutral-300">無連結</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
