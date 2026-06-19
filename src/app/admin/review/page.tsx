import { notFound } from "next/navigation";
import { isAdminKey } from "@/lib/admin-auth";
import { dbEnabled } from "@/lib/env";
import { listProducts } from "@/lib/products";
import { AdminNav } from "../AdminNav";
import { ReviewRow } from "./ReviewRow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SP = Promise<{ [k: string]: string | string[] | undefined }>;

export default async function ReviewPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const key = typeof sp.key === "string" ? sp.key : "";
  if (!isAdminKey(key)) notFound();

  const { items } = await listProducts({ status: "pending_review", limit: 100 });

  return (
    <>
      <AdminNav adminKey={key} active="review" />
      <main className="mx-auto max-w-3xl space-y-3 px-4 py-6">
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-bold">審核佇列</h1>
          <span className="text-sm text-neutral-400">{items.length} 筆待審核</span>
        </div>
        <p className="text-sm text-neutral-500">
          指定人格與類型後「通過 → 上架」（status=active、needs_review=false）。所有動作寫入稽核 log。
        </p>

        {!dbEnabled && (
          <div className="card border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40">
            未設定 <code>DATABASE_URL</code> — 無待審核資料。
          </div>
        )}

        {items.length === 0 && dbEnabled && (
          <div className="card p-6 text-center text-sm text-neutral-400">沒有待審核商品 🎉</div>
        )}

        {items.map((p) => (
          <ReviewRow
            key={p.id}
            adminKey={key}
            product={{
              id: p.id,
              name: p.productName,
              productUrl: p.productUrl,
              platform: p.platform,
              city: p.city,
              category: p.category,
              personas: p.personas,
            }}
          />
        ))}
      </main>
    </>
  );
}
