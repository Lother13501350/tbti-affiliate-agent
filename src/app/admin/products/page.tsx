import { notFound } from "next/navigation";
import Link from "next/link";
import { isAdminKey } from "@/lib/admin-auth";
import { dbEnabled } from "@/lib/env";
import { listProducts } from "@/lib/products";
import { PRODUCT_STATUSES, CATEGORIES, labelOf } from "@/lib/taxonomy";
import { AdminNav } from "../AdminNav";
import { AddProductForm } from "./AddProductForm";
import { ImportPanel } from "./ImportPanel";
import { StatusControl } from "./StatusControl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SP = Promise<{ [k: string]: string | string[] | undefined }>;
const s = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function ProductsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const key = s(sp.key) ?? "";
  if (!isAdminKey(key)) notFound();

  const page = Math.max(1, Number(s(sp.page) ?? "1") || 1);
  const limit = 50;
  const { items, total } = await listProducts({
    platform: s(sp.platform) ?? null,
    status: s(sp.status) ?? null,
    city: s(sp.city) ?? null,
    q: s(sp.q) ?? null,
    limit,
    offset: (page - 1) * limit,
  });
  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <>
      <AdminNav adminKey={key} active="products" />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        {!dbEnabled && (
          <div className="card border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40">
            未設定 <code>DATABASE_URL</code> — 無法新增 / 列出商品。
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <AddProductForm adminKey={key} />
          <ImportPanel adminKey={key} />
        </div>

        {/* 篩選 */}
        <form method="get" className="card flex flex-wrap items-end gap-2 p-3 text-sm">
          <input type="hidden" name="key" value={key} />
          <input name="q" defaultValue={s(sp.q) ?? ""} placeholder="搜尋商品名稱" className="rounded border border-neutral-300 px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900" />
          <select name="platform" defaultValue={s(sp.platform) ?? ""} className="rounded border border-neutral-300 px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900">
            <option value="">全部平台</option>
            <option value="kkday">KKday</option>
            <option value="klook">Klook</option>
            <option value="trip">Trip.com</option>
            <option value="other">其他</option>
          </select>
          <select name="status" defaultValue={s(sp.status) ?? ""} className="rounded border border-neutral-300 px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900">
            <option value="">全部狀態</option>
            {PRODUCT_STATUSES.map((st) => (
              <option key={st.code} value={st.code}>{st.label}</option>
            ))}
          </select>
          <input name="city" defaultValue={s(sp.city) ?? ""} placeholder="城市" className="w-28 rounded border border-neutral-300 px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900" />
          <button className="rounded bg-neutral-900 px-3 py-1.5 font-semibold text-white dark:bg-white dark:text-neutral-900">篩選</button>
          <span className="ml-auto self-center text-xs text-neutral-400">{total} 筆</span>
        </form>

        {/* 列表 */}
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-neutral-500">
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                <th className="p-2">商品</th>
                <th className="p-2">平台</th>
                <th className="p-2">城市</th>
                <th className="p-2">類型</th>
                <th className="p-2">人格</th>
                <th className="p-2 text-right">價格 / 分潤</th>
                <th className="p-2">狀態</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td className="p-3 text-neutral-400" colSpan={7}>尚無商品。用上方「人工新增」或「CSV 匯入」開始。</td>
                </tr>
              )}
              {items.map((p) => (
                <tr key={p.id} className="border-b border-neutral-100 align-top dark:border-neutral-900">
                  <td className="p-2">
                    {p.productUrl ? (
                      <a href={p.productUrl} target="_blank" rel="noreferrer" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                        {p.productName}
                      </a>
                    ) : (
                      <span className="font-medium">{p.productName}</span>
                    )}
                    {p.needsReview && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950">待審</span>}
                    <div className="text-[10px] text-neutral-400">{p.id}</div>
                  </td>
                  <td className="p-2 text-neutral-500">{p.platform}</td>
                  <td className="p-2">{p.city ?? "—"}</td>
                  <td className="p-2">{labelOf(CATEGORIES, p.category) || "—"}</td>
                  <td className="p-2">
                    {p.personas.length ? (
                      <span className="text-xs text-neutral-600 dark:text-neutral-300">{p.personas.join(" ")}</span>
                    ) : (
                      <span className="text-neutral-300">—</span>
                    )}
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {p.priceFrom != null ? `${p.currency ?? ""} ${p.priceFrom}` : "—"}
                    {p.commissionRate != null ? <span className="text-neutral-400"> / {p.commissionRate}%</span> : null}
                  </td>
                  <td className="p-2"><StatusControl adminKey={key} id={p.id} status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-center gap-3 text-sm">
            {page > 1 && (
              <Link href={{ pathname: "/admin/products", query: { ...flatQuery(sp), key, page: page - 1 } }} className="rounded border border-neutral-300 px-3 py-1.5 dark:border-neutral-700">← 上一頁</Link>
            )}
            <span className="text-neutral-500">{page} / {pages}</span>
            {page < pages && (
              <Link href={{ pathname: "/admin/products", query: { ...flatQuery(sp), key, page: page + 1 } }} className="rounded border border-neutral-300 px-3 py-1.5 dark:border-neutral-700">下一頁 →</Link>
            )}
          </div>
        )}
      </main>
    </>
  );
}

function flatQuery(sp: { [k: string]: string | string[] | undefined }): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of ["q", "platform", "status", "city"]) {
    const v = sp[k];
    if (typeof v === "string" && v) out[k] = v;
  }
  return out;
}
