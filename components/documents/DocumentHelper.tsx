"use client";

import { RotateCcw } from "lucide-react";
import { InsightCard } from "./InsightCard";
import { PhotoPicker } from "./PhotoPicker";
import { useDocumentReader } from "./useDocumentReader";
import { useI18n } from "@/lib/i18n/provider";

/** Photograph a notice, challan or message and get it explained in the worker's language. */
export function DocumentHelper() {
  const { t } = useI18n();
  const { phase, note, setNote, preview, read, reset } = useDocumentReader();
  const reading = phase.name === "reading";

  return (
    <div className="space-y-5 px-4 py-5">
      <div>
        <h1 className="text-2xl font-extrabold">{t("doc.title")}</h1>
        <p className="text-sm text-ink-soft">{t("doc.privacy")}</p>
      </div>

      {phase.name !== "done" && (
        <>
          <label className="block">
            <span className="mb-1 block font-bold">{t("doc.note")}</span>
            <input
              value={note}
              maxLength={300}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("doc.note_ph")}
              disabled={reading}
              className="min-h-12 w-full rounded-xl border-2 border-tarmac bg-paper px-3 text-lg outline-none focus:outline-3 focus:outline-strip"
            />
          </label>

          <PhotoPicker disabled={reading} onPick={(file) => void read(file)} />
        </>
      )}

      {preview && (
        // A plain <img> on purpose: this is a blob: URL of the worker's own photo, not an optimisable asset.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="max-h-48 w-full rounded-2xl border-2 border-tarmac bg-paper object-contain" />
      )}

      {reading && (
        <div role="status" aria-label={t("earn.reading")} className="space-y-2">
          <p className="font-bold">{t("earn.reading")}</p>
          <div className="road-dash" />
        </div>
      )}

      {phase.name === "error" && (
        <div role="alert" className="rounded-2xl border-2 border-signal bg-paper p-4">
          <p className="font-bold text-signal">{t(phase.key)}</p>
        </div>
      )}

      {phase.name === "done" && (
        <>
          <InsightCard insight={phase.insight} />
          <button
            type="button"
            onClick={reset}
            className="flex min-h-12 items-center gap-2 rounded-full border-2 border-tarmac bg-paper px-4 font-bold active:bg-line"
          >
            <RotateCcw size={18} aria-hidden />
            {t("doc.again")}
          </button>
        </>
      )}

      <p className="text-center text-sm text-ink-soft">{t("disclaimer")}</p>
    </div>
  );
}
