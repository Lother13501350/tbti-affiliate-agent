import Link from "next/link";
import {
  dbEnabled,
  adminEnabled,
  discordEnabled,
  AGENT_WRITE_ENABLED,
} from "@/lib/env";

// 服務狀態頁。只顯示「有沒有設定」的布林，不外洩任何密鑰值。
export default function Home() {
  const rows: { label: string; ok: boolean; note: string }[] = [
    { label: "資料庫 DATABASE_URL", ok: dbEnabled, note: dbEnabled ? "已連線" : "未設定 → DB 功能停用" },
    { label: "後台密碼 ADMIN_KEY", ok: adminEnabled, note: adminEnabled ? "已啟用閘門" : "未設定 → /admin 一律 403" },
    { label: "寫入開關 AGENT_WRITE_ENABLED", ok: AGENT_WRITE_ENABLED, note: AGENT_WRITE_ENABLED ? "允許寫入型自動化" : "唯讀 / 只報告模式" },
    { label: "Discord Webhook", ok: discordEnabled, note: discordEnabled ? "已設定" : "未設定 → 只寫 console" },
  ];

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-bold">TBTI 聯盟商品 Agent</h1>
      <p className="mt-2 text-sm text-neutral-500">
        聯盟商品與分潤連結生命週期管理 — 獨立服務 + 後台。
      </p>

      <section className="card mt-8 p-5">
        <h2 className="text-sm font-semibold text-neutral-500">服務狀態</h2>
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-4 text-sm">
              <span className="flex items-center gap-2">
                <span aria-hidden className={r.ok ? "text-emerald-500" : "text-neutral-400"}>
                  {r.ok ? "●" : "○"}
                </span>
                {r.label}
              </span>
              <span className="text-neutral-500">{r.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-6">
        <Link
          href="/admin"
          className="inline-flex rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"
        >
          進入後台 →
        </Link>
        <span className="ml-3 text-xs text-neutral-400">需在網址加上 ?key=&lt;ADMIN_KEY&gt;</span>
      </div>
    </main>
  );
}
