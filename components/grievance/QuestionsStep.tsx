"use client";

import { inputClass } from "./Field";
import type { ComplaintForm } from "./useComplaint";
import { useI18n } from "@/lib/i18n/provider";

/** One round of follow-up questions the model asked, so the letter is stronger. The worker may skip them. */
export function QuestionsStep({ form }: { form: ComplaintForm }) {
  const { t } = useI18n();
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-extrabold">{t("cmp.questions")}</h2>
      {form.questions.map((q, i) => (
        <label key={i} className="block">
          <span className="mb-1 block font-bold">{q}</span>
          <input
            className={inputClass}
            value={form.answers[i] ?? ""}
            maxLength={500}
            placeholder={t("cmp.answer_ph")}
            onChange={(e) => form.setAnswer(i, e.target.value)}
          />
        </label>
      ))}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={form.busy}
          onClick={() => void form.submit(true, true)}
          className="min-h-14 rounded-2xl bg-tarmac text-lg font-extrabold text-white active:opacity-80 disabled:opacity-50"
        >
          {form.busy ? t("cmp.writing") : t("cmp.continue")}
        </button>
        <button
          type="button"
          disabled={form.busy}
          onClick={() => void form.submit(true, false)}
          className="min-h-12 rounded-2xl border-2 border-tarmac bg-paper font-bold active:bg-line disabled:opacity-50"
        >
          {t("cmp.skip")}
        </button>
      </div>
      {form.busy && <div className="road-dash" role="status" aria-label={t("cmp.writing")} />}
      {form.error && (
        <p role="alert" className="rounded-xl border-2 border-signal bg-paper p-3 font-bold text-signal">
          {t(form.error)}
        </p>
      )}
    </section>
  );
}
