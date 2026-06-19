"use client";

import { useState } from "react";

const PLATFORMS: [string, string][] = [
  ["kkday", "KKday"],
  ["klook", "Klook"],
  ["trip", "Trip.com"],
  ["other", "其他"],
];

export function ImportPanel({ adminKey }: { adminKey: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"products" | "orders">("products");
  const [platform, setPlatform] = useState("kkday");
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState("");

  async function run() {
    if (!csv.trim()) {
      setOut("請貼上 CSV 內容");
      return;
    }
    setBusy(true);
    setOut("");
    const url = kind === "products" ? "/api/admin/products/import" : "/api/admin/orders/import";
    const body =
      kind === "products" ? { csv, platform: platform || undefined } : { platform, csv };
    try {
      const res = await fetch(`${url}?key=${encodeURIComponent(adminKey)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      setOut(JSON.stringify(j, null, 2));
      if (res.ok && kind === "products") setTimeout(() => location.reload(), 900);
    } catch {
      setOut("網路錯誤");
    }
    setBusy(false);
  }

  return (
    <div className="card p-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-sm font-semibold text-neutral-700 dark:text-neutral-200"
      >
        {open ? "▾" : "▸"} CSV 批次匯入
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2 text-sm">
            <select value={kind} onChange={(e) => setKind(e.target.value as "products" | "orders")} className="rounded border border-neutral-300 px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900">
              <option value="products">商品</option>
              <option value="orders">訂單報表</option>
            </select>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="rounded border border-neutral-300 px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900">
              {PLATFORMS.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <span className="self-center text-xs text-neutral-400">
              {kind === "products" ? "平台可留空（由網址自動辨識）" : "訂單需指定來源平台"}
            </span>
          </div>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={6}
            placeholder={
              kind === "products"
                ? "貼上 CSV：第一列表頭（product_name, affiliate_url, city, category, price...）"
                : "貼上平台訂單報表 CSV（含 order id / status / commission / sub id...）"
            }
            className="w-full rounded border border-neutral-300 p-2 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-900"
          />
          <div className="flex items-center gap-3">
            <button disabled={busy} onClick={run} className="rounded bg-neutral-900 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
              {busy ? "匯入中…" : "匯入"}
            </button>
          </div>
          {out && <pre className="overflow-x-auto rounded bg-neutral-100 p-2 text-xs dark:bg-neutral-900">{out}</pre>}
        </div>
      )}
    </div>
  );
}
