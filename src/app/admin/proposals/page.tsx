import { notFound } from "next/navigation";
import { isAdminKey } from "@/lib/admin-auth";
import { dbEnabled, ANTHROPIC_ENABLED } from "@/lib/env";
import { listProposals } from "@/lib/proposals";
import { AdminNav } from "../AdminNav";
import { ProposalsClient } from "./ProposalsClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SP = Promise<{ [k: string]: string | string[] | undefined }>;

export default async function ProposalsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const key = typeof sp.key === "string" ? sp.key : "";
  if (!isAdminKey(key)) notFound();

  const items = await listProposals();

  return (
    <>
      <AdminNav adminKey={key} active="proposals" />
      <main className="mx-auto max-w-3xl space-y-3 px-4 py-6">
        <h1 className="text-lg font-bold">優化建議(Claude 代理)</h1>
        <p className="text-sm text-neutral-500">
          Claude 只「讀資料、出建議」;你按「通過並執行」才由固定程式動作(暫停 / 增加曝光 / 改標籤),
          replace 與補缺口為提醒。所有動作寫稽核、**不碰佣金與排序**。
        </p>
        {!dbEnabled && (
          <div className="card border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40">
            未設定 <code>DATABASE_URL</code>。
          </div>
        )}
        <ProposalsClient adminKey={key} initial={items} enabled={ANTHROPIC_ENABLED} />
      </main>
    </>
  );
}
