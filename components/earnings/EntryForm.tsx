"use client";

import { Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/messages";
import { validateDraft, type Draft, type DraftError, type DraftField } from "@/lib/earnings/draft";
import { inr } from "@/lib/earnings/format";
import { netOf } from "@/lib/earnings/math";

export const PLATFORMS = ["Swiggy", "Zomato", "Zepto", "Blinkit", "Uber", "Ola", "Rapido", "Porter", "Urban Company", "Daily wage"];

export const ERROR_KEY: Record<DraftError, MessageKey> = {
  number: "earn.err.number",
  date: "earn.err.date",
  future: "earn.err.future",
  range: "earn.err.range",
  none: "earn.err.amount",
};

type Errors = Partial<Record<DraftField, DraftError>>;

function Field({ label, error, children }: { label: string; error?: DraftError; children: ReactNode }) {
  const { t } = useI18n();
  return (
    // justify-end keeps inputs level in a row even when one label wraps onto two lines.
    <label className="flex flex-col justify-end">
      <span className="mb-1 block text-sm font-bold leading-snug">{label}</span>
      {children}
      {error && (
        <span role="alert" className="mt-1 block text-sm font-bold text-signal">
          {t(ERROR_KEY[error])}
        </span>
      )}
    </label>
  );
}

const input =
  "min-h-12 w-full rounded-xl border-2 border-tarmac bg-paper px-3 text-lg outline-none focus:outline-3 focus:outline-strip aria-[invalid=true]:border-signal";

export function EntryForm({
  value,
  errors,
  today,
  onChange,
  onRemove,
}: {
  value: Draft;
  errors: Errors;
  today: string;
  onChange: (d: Draft) => void;
  onRemove?: () => void;
}) {
  const { t } = useI18n();
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value });

  const num = (k: keyof Draft, label: MessageKey) => (
    <Field label={t(label)} error={errors[k]}>
      <input
        className={input}
        inputMode="decimal"
        autoComplete="off"
        value={value[k]}
        onChange={set(k)}
        aria-invalid={Boolean(errors[k])}
      />
    </Field>
  );

  // Live net, so the worker sees what stays in hand before saving.
  const preview = validateDraft(value, today);
  const net = preview.ok ? netOf(preview.entry) : null;

  return (
    <fieldset className="space-y-3 rounded-2xl border-2 border-tarmac bg-dust p-3">
      {/* One column on phones: a date needs the full width to show the year. */}
      <div className="grid grid-cols-1 gap-3 min-[460px]:grid-cols-2">
        <Field label={t("earn.f.date")} error={errors.date}>
          <input type="date" className={input} max={today} value={value.date} onChange={set("date")} aria-invalid={Boolean(errors.date)} />
        </Field>
        <Field label={t("earn.f.platform")}>
          <input className={input} list="saathi-platforms" autoComplete="off" value={value.platform} onChange={set("platform")} maxLength={40} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {num("gross", "earn.f.gross")}
        {num("cuts", "earn.f.cuts")}
        {num("fuel", "earn.f.fuel")}
        {num("other", "earn.f.other")}
      </div>
      {errors.amounts && (
        <p role="alert" className="text-sm font-bold text-signal">
          {t(ERROR_KEY[errors.amounts])}
        </p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {num("orders", "earn.f.orders")}
        {num("hours", "earn.f.hours")}
        {num("km", "earn.f.km")}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="font-extrabold" aria-live="polite">
          {net !== null && t("earn.net_preview", { net: inr(net) })}
        </p>
        {onRemove && (
          <button type="button" onClick={onRemove} className="flex min-h-11 items-center gap-1.5 rounded-full border-2 border-tarmac bg-paper px-3 text-sm font-bold active:bg-line">
            <Trash2 size={16} aria-hidden />
            {t("earn.remove")}
          </button>
        )}
      </div>

    </fieldset>
  );
}

/** Render once per screen; every EntryForm's platform input points at it. */
export function PlatformDatalist() {
  return (
    <datalist id="saathi-platforms">
      {PLATFORMS.map((p) => (
        <option key={p} value={p} />
      ))}
    </datalist>
  );
}
