"use client";

import { Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import { DescribeSection } from "./DescribeSection";
import { EntryForm, PlatformDatalist } from "./EntryForm";
import { useAddEarnings } from "./useAddEarnings";
import { useI18n } from "@/lib/i18n/provider";
import { todayISO } from "@/lib/earnings/dates";
import type { NewEntry } from "@/lib/earnings/math";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Entries to start with, e.g. ones the chat proposed. The worker still checks them before saving. */
  initial?: NewEntry[];
}

/** The "add earnings" sheet: describe it, review the form, save. Nothing is saved without confirmation. */
export function AddEarnings({ open, onClose, initial }: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const form = useAddEarnings(onClose);
  const { reset } = form;

  // Open and close the native dialog from `open`; the form starts fresh every time it opens.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      reset(initial);
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, initial, reset]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={t("earn.sheet.title")}
      className="m-auto max-h-[92dvh] w-[min(94vw,36rem)] overflow-y-auto rounded-2xl border-4 border-tarmac bg-paper p-0 backdrop:bg-tarmac/60"
    >
      <div className="space-y-4 p-4">
        <h2 className="text-xl font-extrabold">{t("earn.sheet.title")}</h2>

        <DescribeSection
          text={form.text}
          onText={form.setText}
          busy={form.busy}
          notice={form.notice}
          question={form.question}
          onParse={() => void form.parseText()}
          onPhoto={(file) => void form.parsePhoto(file)}
        />

        <section className="space-y-3">
          <h3 className="font-extrabold">{t("earn.review")}</h3>
          <PlatformDatalist />
          {form.drafts.map((d, i) => (
            <EntryForm
              key={i}
              value={d}
              errors={form.errors[i] ?? {}}
              today={todayISO()}
              onChange={(next) => form.updateDraft(i, next)}
              onRemove={form.drafts.length > 1 ? () => form.removeDraft(i) : undefined}
            />
          ))}
          <button
            type="button"
            onClick={form.addDraft}
            className="flex min-h-11 items-center gap-1.5 rounded-full border-2 border-dashed border-tarmac px-4 font-bold active:bg-line"
          >
            <Plus size={16} aria-hidden />
            {t("earn.add_another")}
          </button>
        </section>

        <div className="flex gap-3 border-t-2 border-line pt-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 flex-1 rounded-xl border-2 border-tarmac bg-paper font-bold active:bg-line"
          >
            {t("earn.cancel")}
          </button>
          <button
            type="button"
            onClick={() => void form.save()}
            disabled={form.busy !== null || form.drafts.length === 0}
            className="min-h-12 flex-[2] rounded-xl bg-highway font-extrabold text-white active:opacity-80 disabled:opacity-40"
          >
            {t("earn.save")}
          </button>
        </div>
      </div>
    </dialog>
  );
}
