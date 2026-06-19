"use client";

import { useState } from "react";
import { TAGGABLE_PERSONAS, personaTitle } from "@/lib/personas";
import { CATEGORIES } from "@/lib/taxonomy";

export interface ReviewProduct {
  id: string;
  name: string;
  productUrl: string | null;
  platform: string;
  city: string | null;
  category: string | null;
  personas: string[];
}

export function ReviewRow({ adminKey, product }: { adminKey: string; product: ReviewProduct }) {
  const [sel, setSel] = useState<string[]>(product.personas ?? []);
  const [cat, setCat] = useState(product.category ?? "");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [note, setNote] = useState("");

  async function classify() {
    setBusy(true);
    setNote("AI 分類中…");
    try {
      const res = await fetch(`/api/admin/products/${product.id}/classify?key=${encodeURIComponent(adminKey)}`, {
        method: "POST",
      });
      const j = await res.json();
      if (res.ok) {
        setNote(`AI 信心 ${(j.classification?.confidence ?? 0).toFixed(2)}（${j.decision?.tier}）— 重新整理套用`);
        setTimeout(() => location.reload(), 700);
      } else {
        setNote(j.hint || j.error || "分類失敗");
      }
    } catch {
      setNote("網路錯誤");
    }
    setBusy(false);
  }

  function toggle(code: string) {
    setSel((p) => (p.includes(code) ? p.filter((x) => x !== code) : [...p, code]));
  }

  async function act(status: "active" | "rejected" | "paused") {
    setBusy(true);
    const body: Record<string, unknown> = { status };
    if (status === "active") {
      body.personas = sel;
      body.category = cat || undefined;
      body.needsReview = false;
    }
    try {
      const res = await fetch(`/api/admin/products/${product.id}?key=${encodeURIComponent(adminKey)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) setDone(status);
    } catch {
      /* ignore */
    }
    setBusy(false);
  }

  if (done) {
    return (
      <div className="card p-3 text-sm text-neutral-400">
        已處理：{product.name} → {done}
      </div>
    );
  }

  return (
    <div className="card p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          {product.productUrl ? (
            <a href={product.productUrl} target="_blank" rel="noreferrer" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
              {product.name}
            </a>
          ) : (
            <span className="font-semibold">{product.name}</span>
          )}
          <div className="text-xs text-neutral-400">
            {product.platform}　{product.city ?? "—"}　{product.id}
          </div>
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900">
          <option value="">— 類型 —</option>
          {CATEGORIES.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {TAGGABLE_PERSONAS.map((p) => (
          <button
            key={p.code}
            onClick={() => toggle(p.code)}
            title={p.title}
            className={`rounded px-2 py-0.5 text-xs ${
              sel.includes(p.code)
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
            }`}
          >
            {p.code}
          </button>
        ))}
      </div>
      {sel.length > 0 && (
        <div className="mt-1 text-[11px] text-neutral-400">{sel.map((c) => personaTitle(c)).join("・")}</div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button disabled={busy} onClick={classify} className="rounded border border-blue-300 px-3 py-1.5 text-sm text-blue-600 disabled:opacity-50 dark:border-blue-900 dark:text-blue-400">
          AI 分類
        </button>
        <button disabled={busy} onClick={() => act("active")} className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
          通過 → 上架
        </button>
        <button disabled={busy} onClick={() => act("paused")} className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">
          暫停
        </button>
        <button disabled={busy} onClick={() => act("rejected")} className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-900">
          拒絕
        </button>
        {note && <span className="text-xs text-neutral-500">{note}</span>}
      </div>
    </div>
  );
}
