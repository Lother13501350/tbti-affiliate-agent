"use client";

import { useState } from "react";
import type { Proposal } from "@/lib/proposals";

const KIND: Record<string, { label: string; cls: string }> = {
  pause: { label: "暫停曝光", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  boost: { label: "增加曝光", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" },
  retag: { label: "改標籤", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200" },
  replace: { label: "替換失效", cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" },
  add_gap: { label: "補缺口", cls: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200" },
};
const STATUS: Record<string, string> = { pending: "待核准", applied: "已執行", approved: "已核准", rejected: "已駁回" };

export function ProposalsClient({
  adminKey,
  initial,
  enabled,
}: {
  adminKey: string;
  initial: Proposal[];
  enabled: boolean;
}) {
  const k = `key=${encodeURIComponent(adminKey)}`;
  const [items, setItems] = useState<Proposal[]>(initial);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState("");

  async function run() {
    setRunning(true);
    setNote("Claude 分析中…(通常 30–90 秒)");
    try {
      const res = await fetch(`/api/admin/optimize?${k}`, { method: "POST" });
      const j = await res.json();
      if (res.ok) {
        setNote(`產生 ${j.proposals?.length ?? 0} 條建議 · ${j.turns ?? 0} turns · 擋下 ${j.denials ?? 0} 次非授權工具 · $${(j.costUsd ?? 0).toFixed(4)}`);
        setTimeout(() => location.reload(), 900);
      } else {
        setNote(j.hint || j.detail || j.error || "失敗");
      }
    } catch {
      setNote("網路錯誤");
    }
    setRunning(false);
  }

  async function decide(id: string, decision: "approved" | "rejected") {
    try {
      const res = await fetch(`/api/admin/proposals/${id}?${k}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const j = await res.json();
      if (res.ok && j.proposal) setItems((p) => p.map((x) => (x.id === id ? j.proposal : x)));
    } catch {
      /* ignore */
    }
  }

  const pending = items.filter((p) => p.status === "pending");
  const done = items.filter((p) => p.status !== "pending");

  return (
    <div className="space-y-4">
      <div className="card p-3">
        <button
          disabled={running || !enabled}
          onClick={run}
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {running ? "分析中…" : "讓 Claude 分析一輪"}
        </button>
        {!enabled && <span className="ml-3 text-xs text-amber-600">未設定 ANTHROPIC_API_KEY → 設定後才能跑</span>}
        {note && <div className="mt-2 text-xs text-neutral-500">{note}</div>}
      </div>

      <ProposalList title={`待核准 (${pending.length})`} items={pending} decide={decide} emptyHint />
      {done.length > 0 && <ProposalList title="歷史" items={done} />}
    </div>
  );
}

function ProposalList({
  title,
  items,
  decide,
  emptyHint,
}: {
  title: string;
  items: Proposal[];
  decide?: (id: string, d: "approved" | "rejected") => void;
  emptyHint?: boolean;
}) {
  if (items.length === 0) {
    return emptyHint ? (
      <div className="card p-6 text-center text-sm text-neutral-400">
        目前沒有待核准建議。按上面的按鈕讓 Claude 跑一輪。
      </div>
    ) : null;
  }
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-neutral-500">{title}</h2>
      {items.map((p) => {
        const kind = KIND[p.kind] ?? { label: p.kind, cls: "bg-neutral-100" };
        return (
          <div key={p.id} className="card p-3">
            <div className="flex items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${kind.cls}`}>{kind.label}</span>
              {p.productId && <span className="text-xs text-neutral-400">{p.productId}</span>}
              <span className="ml-auto text-xs text-neutral-400">{STATUS[p.status] ?? p.status}</span>
            </div>
            <div className="mt-1.5 text-sm">{p.rationale}</div>
            {p.evidence && <div className="mt-0.5 text-xs text-neutral-500">數據:{p.evidence}</div>}
            {p.suggestedAlternativeId && <div className="mt-0.5 text-xs text-neutral-500">建議替代:{p.suggestedAlternativeId}</div>}
            {(p.persona || p.city) && <div className="mt-0.5 text-xs text-neutral-500">{p.persona ?? ""} {p.city ?? ""}</div>}
            {p.personas && p.personas.length > 0 && <div className="mt-0.5 text-xs text-neutral-500">標籤:{p.personas.join(" ")}</div>}
            {decide && p.status === "pending" && (
              <div className="mt-2 flex gap-2">
                <button onClick={() => decide(p.id, "approved")} className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white">
                  通過並執行
                </button>
                <button onClick={() => decide(p.id, "rejected")} className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-900">
                  駁回
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
