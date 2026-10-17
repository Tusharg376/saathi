"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { Tri } from "@/lib/eligibility/form";

const OPTIONS: { value: Tri; key: "qual.yes" | "qual.no" | "qual.unsure" }[] = [
  { value: "yes", key: "qual.yes" },
  { value: "no", key: "qual.no" },
  { value: "unsure", key: "qual.unsure" },
];

/** Yes, No or Not sure. "Not sure" leaves the fact unknown, so it can never rule a worker out. */
export function TriState({ label, value, onChange }: { label: string; value: Tri; onChange: (v: Tri) => void }) {
  const { t } = useI18n();
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-bold leading-snug">{label}</legend>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border-2 border-tarmac px-2 text-center text-sm font-bold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-strip ${
              value === o.value ? "bg-tarmac text-white" : "bg-paper"
            }`}
          >
            <input type="radio" className="sr-only" name={label} checked={value === o.value} onChange={() => onChange(o.value)} />
            {t(o.key)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
