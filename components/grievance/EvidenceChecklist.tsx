"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

/** What to gather before sending. Ticking items off is for the worker's own tracking only. */
export function EvidenceChecklist({ items }: { items: string[] }) {
  const { t } = useI18n();
  const [done, setDone] = useState<Record<number, boolean>>({});
  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl border-2 border-tarmac bg-paper p-4 print:hidden">
      <h2 className="mb-2 font-extrabold">{t("cmp.evidence")}</h2>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i}>
            <label className="flex min-h-11 cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={Boolean(done[i])}
                onChange={(e) => setDone((d) => ({ ...d, [i]: e.target.checked }))}
                className="mt-1 size-5 shrink-0 accent-tarmac"
              />
              <span className={done[i] ? "text-ink-soft line-through" : ""}>{item}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
