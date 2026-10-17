"use client";

import { IndianRupee, PenLine } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import type { ChatAction } from "@/lib/agent/events";
import { inr, shortDate } from "@/lib/earnings/format";
import { ISSUE_LABEL } from "@/lib/grievance/labels";
import { useHandoffNav } from "@/lib/useHandoffNav";

const card = "space-y-2 rounded-2xl border-2 border-tarmac bg-plate/40 p-3";
const button =
  "flex min-h-11 items-center gap-2 rounded-full bg-tarmac px-4 font-bold text-white active:opacity-80";

/**
 * Next steps the assistant suggests. These only open the right screen with the details filled in:
 * nothing is saved or sent until the worker checks it there and confirms.
 */
export function ActionCards({ actions }: { actions: ChatAction[] }) {
  const { t, speechLang } = useI18n();
  const goWith = useHandoffNav();

  return (
    <ul className="space-y-2">
      {actions.map((a, i) => (
        <li key={i} className={card}>
          {a.kind === "log_earning" ? (
            <>
              <p className="flex items-center gap-2 font-extrabold">
                <IndianRupee size={18} aria-hidden />
                {t("act.earning.title")}
              </p>
              <p>
                {shortDate(a.entry.date, speechLang)} · {a.entry.platform} · {inr(a.entry.grossInr)}
                {a.entry.fuelInr > 0 && ` · ${t("earn.stat.fuel")} ${inr(a.entry.fuelInr)}`}
              </p>
              <button type="button" className={button} onClick={() => goWith("earnings", { entries: [a.entry] })}>
                {t("act.earning.cta")}
              </button>
            </>
          ) : (
            <>
              <p className="flex items-center gap-2 font-extrabold">
                <PenLine size={18} aria-hidden />
                {t("act.complaint.title")}: {t(ISSUE_LABEL[a.issue])}
              </p>
              <p className="text-ink-soft">{a.summary}</p>
              <button
                type="button"
                className={button}
                onClick={() => goWith("complaint", { issue: a.issue, description: a.summary, party: a.party })}
              >
                {t("act.complaint.cta")}
              </button>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
