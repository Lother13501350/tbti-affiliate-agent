"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/taxonomy";
import { detectPlatform } from "@/lib/adapters";

function val(f: FormData, k: string): string | undefined {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function AddProductForm({ adminKey }: { adminKey: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setMsg("");
    const body = {
      productName: val(f, "productName"),
      productUrl: val(f, "productUrl"),
      affiliateUrl: val(f, "affiliateUrl"),
      city: val(f, "city"),
      category: val(f, "category"),
      priceFrom: val(f, "priceFrom"),
      currency: val(f, "currency"),
      commissionRate: val(f, "commissionRate"),
    };
    try {
      const res = await fetch(`/api/admin/products?key=${encodeURIComponent(adminKey)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (res.ok) {
        setMsg(`✓ 已新增 ${j.product.id}${j.link ? `　跳轉：/go/${j.link.code}` : ""}`);
        form.reset();
        setTimeout(() => location.reload(), 600);
      } else {
        setMsg(`✗ ${j.error ?? res.status}`);
      }
    } catch {
      setMsg("✗ 網路錯誤");
    }
    setBusy(false);
  }

  const detected = (url: string) => (url ? detectPlatform(url) : "");

  return (
    <div className="card p-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-sm font-semibold text-neutral-700 dark:text-neutral-200"
      >
        {open ? "▾" : "▸"} 人工新增商品
      </button>
      {open && (
        <form onSubmit={onSubmit} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <input name="productName" required placeholder="商品名稱 *" className="col-span-2 rounded border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900 sm:col-span-3" />
          <input name="productUrl" placeholder="商品網址" className="col-span-2 rounded border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900 sm:col-span-3" />
          <input name="affiliateUrl" placeholder="分潤網址（建議填，會自動建 /go 連結）" className="col-span-2 rounded border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900 sm:col-span-3" onChange={(e) => setMsg(e.currentTarget.value ? `偵測平台：${detected(e.currentTarget.value)}` : "")} />
          <input name="city" placeholder="城市（如 osaka）" className="rounded border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900" />
          <select name="category" defaultValue="" className="rounded border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900">
            <option value="">— 類型 —</option>
            {CATEGORIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <input name="priceFrom" placeholder="價格" inputMode="decimal" className="rounded border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900" />
            <input name="currency" placeholder="幣別" className="rounded border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900" />
            <input name="commissionRate" placeholder="分潤%" inputMode="decimal" className="rounded border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900" />
          </div>
          <div className="col-span-2 flex items-center gap-3 sm:col-span-3">
            <button disabled={busy} className="rounded bg-neutral-900 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
              {busy ? "送出中…" : "新增（進待審核）"}
            </button>
            {msg && <span className="text-xs text-neutral-500">{msg}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
