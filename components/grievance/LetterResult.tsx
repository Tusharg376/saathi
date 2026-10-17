"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { EscalationLadder } from "./EscalationLadder";
import { EvidenceChecklist } from "./EvidenceChecklist";
import { ShareActions } from "./ShareActions";
import { SpeakButton } from "../voice/SpeakButton";
import { useI18n } from "@/lib/i18n/provider";
import { issueEntry, unfilled, type Issue } from "@/lib/grievance/letter";
import type { LetterView } from "@/lib/grievance/view";
import { localizeEntry } from "@/lib/kb/localize";

/** Placeholders still showing in the letter. The worker must fix these before sending. */
function GapsWarning({ gaps }: { gaps: string[] }) {
  const { t } = useI18n();
  if (gaps.length === 0) return null;
  return (
    <div role="alert" className="rounded-xl border-2 border-signal bg-paper p-3">
      <p className="flex items-center gap-2 font-bold text-signal">
        <AlertTriangle size={18} aria-hidden />
        {t("cmp.fill_gaps")}
      </p>
      <ul className="mt-1 list-disc pl-6 font-mono text-sm">
        {gaps.map((g) => (
          <li key={g}>{g}</li>
        ))}
      </ul>
    </div>
  );
}

interface Props {
  issue: Issue;
  view: LetterView;
  onChange: (letter: string) => void;
  onRestart: () => void;
}

/** The finished draft: what it says, the letter to read and edit, how to send it, and what to do next. */
export function LetterResult({ issue, view, onChange, onRestart }: Props) {
  const { t, lang } = useI18n();
  const english = issueEntry(issue);
  const entry = english && localizeEntry(english, lang);

  return (
    <div className="space-y-5">
      {view.notice && (
        <p role="status" className="rounded-xl border-2 border-dashed border-tarmac bg-paper p-3 font-bold">
          {t(view.notice)}
        </p>
      )}

      {view.summary && (
        <section className="rounded-2xl border-2 border-tarmac bg-paper p-4 print:hidden">
          <h2 className="mb-1 text-sm font-extrabold uppercase tracking-wide text-ink-soft">{t("cmp.says")}</h2>
          <p className="whitespace-pre-wrap text-lg">{view.summary}</p>
          <SpeakButton text={view.summary} className="mt-3" />
        </section>
      )}

      <section className="space-y-3 print:hidden">
        <h2 className="font-extrabold">{t("cmp.review")}</h2>
        <p className="text-sm text-ink-soft">{t("cmp.draft_note")}</p>
        <GapsWarning gaps={unfilled(view.letter)} />
        <label className="block">
          <span className="sr-only">{t("cmp.letter_edit")}</span>
          <textarea
            value={view.letter}
            onChange={(e) => onChange(e.target.value)}
            rows={18}
            className="w-full resize-y rounded-2xl border-2 border-tarmac bg-paper p-3 text-base leading-relaxed outline-none focus:outline-3 focus:outline-strip"
          />
        </label>
        <p className="text-sm text-ink-soft">{t("cmp.letter_edit")}</p>
        <ShareActions letter={view.letter} subject={view.subject} />
      </section>

      {/* Printed output: only the letter, plain and readable. Textareas print badly, so print text instead. */}
      <pre className="hidden whitespace-pre-wrap font-sans text-base leading-relaxed print:block">{view.letter}</pre>

      <EvidenceChecklist items={view.evidence.length ? view.evidence : (entry?.documents_needed ?? [])} />
      {entry && <EscalationLadder entry={entry} />}

      <button
        type="button"
        onClick={onRestart}
        className="flex min-h-12 items-center gap-2 rounded-full border-2 border-tarmac bg-paper px-4 font-bold active:bg-line print:hidden"
      >
        <RotateCcw size={18} aria-hidden />
        {t("cmp.start_over")}
      </button>
    </div>
  );
}
