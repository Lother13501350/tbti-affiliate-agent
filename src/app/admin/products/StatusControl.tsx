"use client";

import { useState } from "react";
import { PRODUCT_STATUSES } from "@/lib/taxonomy";

export function StatusControl({
  adminKey,
  id,
  status,
}: {
  adminKey: string;
  id: string;
  status: string;
}) {
  const [val, setVal] = useState(status);
  const [busy, setBusy] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const s = e.target.value;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/products/${id}?key=${encodeURIComponent(adminKey)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: s }),
      });
      if (res.ok) setVal(s);
    } catch {
      /* ignore */
    }
    setBusy(false);
  }

  return (
    <select
      value={val}
      disabled={busy}
      onChange={onChange}
      className="rounded border border-neutral-300 px-1.5 py-1 text-xs disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900"
    >
      {PRODUCT_STATUSES.map((s) => (
        <option key={s.code} value={s.code}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
