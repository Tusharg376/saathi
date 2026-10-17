"use client";

import { ArrowLeft } from "lucide-react";
import { ContactFields } from "./ContactFields";
import { Field, inputClass } from "./Field";
import type { ComplaintForm } from "./useComplaint";
import { MicButton } from "../voice/MicButton";
import { useI18n } from "@/lib/i18n/provider";
import { ISSUE_LABEL } from "@/lib/grievance/labels";

/** Step two: what happened. A box in the worker's own words (or voice), a few details, and who they are. */
export function DescribeStep({ form }: { form: ComplaintForm }) {
  const { t, lang } = useI18n();
  const { issue, fields, setFields } = form;
  if (!issue) return null;
  const setField = (k: keyof typeof fields) => (e: { target: { value: string } }) =>
    setFields({ ...fields, [k]: e.target.value });

  return (
    <section className="space-y-4">
      <button
        type="button"
        onClick={() => form.goTo("issue")}
        className="flex min-h-11 items-center gap-1.5 rounded-full px-1 font-bold active:bg-line print:hidden"
      >
        <ArrowLeft size={18} aria-hidden />
        {t("cmp.step1")}
      </button>
      <h2 className="text-xl font-extrabold">{t(ISSUE_LABEL[issue])}</h2>

      <label className="block">
        <span className="mb-1 block font-extrabold">{t("cmp.step2")}</span>
        <textarea
          rows={6}
          maxLength={3000}
          value={form.description}
          onChange={(e) => form.setDescription(e.target.value)}
          placeholder={t("cmp.desc_ph")}
          className="w-full resize-y rounded-xl border-2 border-tarmac bg-paper px-3 py-2 text-lg outline-none focus:outline-3 focus:outline-strip"
        />
      </label>
      <MicButton value={form.description} onChange={form.setDescription} variant="pill" />

      <div className="grid grid-cols-1 gap-3 min-[460px]:grid-cols-2">
        <Field label={t("cmp.party")}>
          <input className={inputClass} value={fields.party} maxLength={80} onChange={setField("party")} />
        </Field>
        <Field label={t("cmp.dates")}>
          <input className={inputClass} value={fields.dates} maxLength={80} onChange={setField("dates")} />
        </Field>
        <Field label={t("cmp.amount")}>
          <input className={inputClass} inputMode="decimal" value={fields.amount} onChange={setField("amount")} />
        </Field>
        <Field label={t("cmp.ids")}>
          <input className={inputClass} value={fields.ids} maxLength={200} onChange={setField("ids")} />
        </Field>
      </div>

      <ContactFields contact={form.contact} onChange={form.setContact} />

      {lang !== "en" && (
        <fieldset className="space-y-2">
          <legend className="font-extrabold">{t("cmp.letter_lang")}</legend>
          {(["en", "app"] as const).map((v) => (
            <label
              key={v}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 border-tarmac bg-paper px-3"
            >
              <input
                type="radio"
                name="letterLang"
                checked={form.letterLang === v}
                onChange={() => form.setLetterLang(v)}
                className="size-5 accent-tarmac"
              />
              <span className="font-bold">{t(v === "en" ? "cmp.letter_en" : "cmp.letter_app")}</span>
            </label>
          ))}
        </fieldset>
      )}

      {form.error && (
        <p role="alert" className="rounded-xl border-2 border-signal bg-paper p-3 font-bold text-signal">
          {t(form.error)}
        </p>
      )}

      <button
        type="button"
        disabled={form.busy}
        onClick={() => void form.submit(false, false)}
        className="min-h-14 w-full rounded-2xl bg-tarmac text-lg font-extrabold text-white active:opacity-80 disabled:opacity-50"
      >
        {form.busy ? t("cmp.writing") : t("cmp.make")}
      </button>
      {form.busy && <div className="road-dash" role="status" aria-label={t("cmp.writing")} />}
    </section>
  );
}
