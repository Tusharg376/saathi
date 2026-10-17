"use client";

import { KbCard, StatusBadge } from "../KbCard";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/messages";
import type { EligibilityResult, Verdict } from "@/lib/eligibility/engine";
import { FIELD_LABEL } from "@/lib/eligibility/labels";
import { getEntry } from "@/lib/kb";

const VERDICT: Record<Verdict, { key: MessageKey; cls: string }> = {
  likely: { key: "qual.likely", cls: "bg-highway text-white border-highway" },
  maybe: { key: "qual.maybe", cls: "bg-plate text-tarmac border-tarmac" },
  not_eligible: { key: "qual.not_eligible", cls: "bg-paper text-ink-soft border-line" },
};

/** One scheme's result: the verdict, whether the scheme is actually running, and what would settle a "maybe". */
function ResultRow({ result }: { result: EligibilityResult }) {
  const { t } = useI18n();
  const entry = getEntry(result.schemeId);
  const { key, cls } = VERDICT[result.verdict];
  const needs = result.needs.map((f) => t(FIELD_LABEL[f])).join(", ");

  return (
    <li className="space-y-2 rounded-2xl border-2 border-tarmac bg-paper p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border-2 px-2.5 py-0.5 text-sm font-extrabold ${cls}`}>{t(key)}</span>
        {result.status !== "live" && <StatusBadge status={result.status} />}
      </div>
      <p className="font-extrabold leading-snug">{result.title}</p>
      {result.verdict === "maybe" && needs && <p className="text-sm text-ink-soft">{t("qual.need", { what: needs })}</p>}
      {entry && (
        <details className="rounded-xl border-2 border-line">
          <summary className="min-h-11 cursor-pointer select-none px-3 py-2 font-bold">{t("rights.eligibility")}</summary>
          <div className="p-2 pt-0">
            <KbCard entry={entry} showActions={false} />
          </div>
        </details>
      )}
    </li>
  );
}

export function EligibilityResults({ results }: { results: EligibilityResult[] }) {
  return (
    <ul className="space-y-3">
      {results.map((r) => (
        <ResultRow key={r.schemeId} result={r} />
      ))}
    </ul>
  );
}
