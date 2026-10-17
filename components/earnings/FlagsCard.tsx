"use client";

import { AlertTriangle, PenLine } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import { complaintPrefillFor, flagMessage } from "@/lib/earnings/flags";
import type { Anomaly } from "@/lib/earnings/math";
import type { ComplaintPrefill } from "@/lib/handoff";

/**
 * Warnings worth a second look. A large platform cut also offers the next step: a complaint
 * that is already filled in with what the worker's own entries show.
 */
export function FlagsCard({ flags, onComplain }: { flags: Anomaly[]; onComplain: (p: ComplaintPrefill) => void }) {
  const { t, speechLang } = useI18n();
  if (flags.length === 0) return null;

  return (
    <section aria-labelledby="flags-h" className="space-y-2 rounded-2xl border-2 border-dashed border-tarmac bg-paper p-4">
      <h2 id="flags-h" className="flex items-center gap-2 font-extrabold">
        <AlertTriangle size={20} aria-hidden />
        {t("earn.flags")}
      </h2>
      <ul className="space-y-3">
        {flags.map((flag, i) => {
          const prefill = complaintPrefillFor(flag);
          return (
            <li key={i} className="border-l-4 border-plate pl-3">
              <p>{flagMessage(flag, t, speechLang)}</p>
              {prefill && (
                <button
                  type="button"
                  onClick={() => onComplain(prefill)}
                  className="mt-2 flex min-h-11 items-center gap-1.5 rounded-full border-2 border-tarmac bg-paper px-3 text-sm font-bold active:bg-line"
                >
                  <PenLine size={16} aria-hidden />
                  {t("earn.flag_complain")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
