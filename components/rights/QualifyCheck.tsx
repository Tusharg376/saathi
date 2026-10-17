"use client";

import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { EligibilityResults } from "./EligibilityResults";
import { TriState } from "./TriState";
import { Field, inputClass } from "../grievance/Field";
import { useI18n } from "@/lib/i18n/provider";
import { checkEligibility, type EligibilityReport } from "@/lib/eligibility/engine";
import { formFromProfile, profileFromForm, type QualifyForm, type Tri } from "@/lib/eligibility/form";
import { FIELD_LABEL, WORK_LABEL } from "@/lib/eligibility/labels";
import { INDIAN_STATES } from "@/lib/eligibility/states";
import { saveProfile, useProfile } from "@/lib/profile/store";
import { useHandoffNav } from "@/lib/useHandoffNav";

const TRI_FIELDS = ["platform", "tax", "pf", "bank", "eshram"] as const satisfies readonly (keyof QualifyForm)[];
const TRI_LABEL = {
  platform: "isPlatformWorker",
  tax: "isIncomeTaxPayer",
  pf: "inEpfoOrEsic",
  bank: "hasBankAccount",
  eshram: "hasEshram",
} as const;

type SetField = <K extends keyof QualifyForm>(key: K, value: QualifyForm[K]) => void;

/** The questions themselves: numbers, state, kind of work, and the yes / no / not sure ones. */
function QualifyFields({ form, set }: { form: QualifyForm; set: SetField }) {
  const { t } = useI18n();
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("qual.age")}>
          <input
            className={inputClass}
            inputMode="numeric"
            value={form.age}
            onChange={(e) => set("age", e.target.value)}
          />
        </Field>
        <Field label={t("qual.income")}>
          <input
            className={inputClass}
            inputMode="decimal"
            value={form.income}
            onChange={(e) => set("income", e.target.value)}
          />
        </Field>
      </div>

      <Field label={t("qual.state")}>
        <input
          className={inputClass}
          list="saathi-states"
          value={form.state}
          maxLength={60}
          onChange={(e) => set("state", e.target.value)}
        />
      </Field>
      <datalist id="saathi-states">
        {INDIAN_STATES.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <Field label={t("qual.work")}>
        <select
          className={inputClass}
          value={form.workerType}
          onChange={(e) => set("workerType", e.target.value as QualifyForm["workerType"])}
        >
          <option value="">{t("qual.work_pick")}</option>
          {(Object.keys(WORK_LABEL) as (keyof typeof WORK_LABEL)[]).map((w) => (
            <option key={w} value={w}>
              {t(WORK_LABEL[w])}
            </option>
          ))}
        </select>
      </Field>

      {TRI_FIELDS.map((f) => (
        <TriState key={f} label={t(FIELD_LABEL[TRI_LABEL[f]])} value={form[f]} onChange={(v: Tri) => set(f, v)} />
      ))}
    </>
  );
}

/**
 * "What do I qualify for?" Runs the real eligibility rules against the worker's answers, remembers the
 * answers on this phone, and hands over to the chat to explain the result in their language.
 */
export function QualifyCheck() {
  const { t } = useI18n();
  const goWith = useHandoffNav();
  const saved = useProfile();
  const [edits, setEdits] = useState<QualifyForm | null>(null);
  const [report, setReport] = useState<EligibilityReport | null>(null);

  // Until the worker types something, show what they told us last time.
  const form = edits ?? formFromProfile(saved);
  const set = <K extends keyof QualifyForm>(k: K, v: QualifyForm[K]) => setEdits({ ...form, [k]: v });

  const check = () => {
    const profile = profileFromForm(form);
    saveProfile(profile);
    setReport(checkEligibility(profile));
  };

  return (
    <details className="rounded-2xl border-2 border-tarmac bg-paper">
      <summary className="min-h-14 cursor-pointer select-none px-4 py-3 text-lg font-extrabold">
        {t("qual.title")}
      </summary>

      <div className="space-y-4 p-4 pt-0">
        <p className="text-sm text-ink-soft">{t("qual.sub")}</p>

        <QualifyFields form={form} set={set} />

        <button
          type="button"
          onClick={check}
          className="min-h-12 w-full rounded-2xl bg-tarmac text-lg font-extrabold text-white active:opacity-80"
        >
          {t("qual.check")}
        </button>
        <p className="text-center text-sm text-ink-soft">{t("qual.saved")}</p>

        {report && (
          <section aria-labelledby="qual-results" className="space-y-3">
            <h2 id="qual-results" className="text-lg font-extrabold">
              {t("qual.results")}
            </h2>
            <EligibilityResults results={report.results} />
            <button
              type="button"
              onClick={() => goWith("chat", { prompt: t("qual.explain_prompt") })}
              className="flex min-h-12 items-center gap-2 rounded-full border-2 border-tarmac bg-paper px-4 font-bold active:bg-line"
            >
              <MessageCircle size={18} aria-hidden />
              {t("qual.explain")}
            </button>
          </section>
        )}
      </div>
    </details>
  );
}
