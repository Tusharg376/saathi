"use client";

import { DescribeStep } from "./DescribeStep";
import { IssuePicker } from "./IssuePicker";
import { LetterResult } from "./LetterResult";
import { QuestionsStep } from "./QuestionsStep";
import { useComplaint } from "./useComplaint";
import { useI18n } from "@/lib/i18n/provider";

/** Write a complaint: pick the problem, say what happened, review a letter you can send. */
export function ComplaintWizard() {
  const { t } = useI18n();
  const form = useComplaint();

  return (
    <div className="space-y-5 px-4 py-5">
      <h1 className="text-2xl font-extrabold print:hidden">{t("cmp.title")}</h1>

      {form.step === "issue" && <IssuePicker onPick={form.choose} />}
      {form.step === "describe" && <DescribeStep form={form} />}
      {form.step === "questions" && <QuestionsStep form={form} />}
      {form.step === "result" && form.issue && form.view && (
        <LetterResult
          issue={form.issue}
          view={form.view}
          onChange={(letter) => form.view && form.setView({ ...form.view, letter })}
          onRestart={form.restart}
        />
      )}

      <p className="text-center text-sm text-ink-soft print:hidden">{t("disclaimer")}</p>
    </div>
  );
}
