import type { ReactNode } from "react";

export const inputClass =
  "min-h-12 w-full rounded-xl border-2 border-tarmac bg-paper px-3 text-lg outline-none focus:outline-3 focus:outline-strip";

/** A labelled form field. justify-end keeps inputs level in a row even when one label wraps. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col justify-end gap-1">
      <span className="text-sm font-bold leading-snug">{label}</span>
      {children}
    </label>
  );
}
