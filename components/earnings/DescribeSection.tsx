"use client";

import { Camera, Sparkles } from "lucide-react";
import { useRef } from "react";
import { MicButton } from "../voice/MicButton";
import type { Busy, Notice } from "./useAddEarnings";
import { useI18n } from "@/lib/i18n/provider";

interface Props {
  text: string;
  onText: (v: string) => void;
  busy: Busy;
  notice: Notice;
  question: string;
  onParse: () => void;
  onPhoto: (file: File) => void;
}

/** "Say or type it": a sentence, a spoken sentence, or a screenshot, turned into entries for the worker to confirm. */
export function DescribeSection({ text, onText, busy, notice, question, onParse, onPhoto }: Props) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const reading = busy === "text" || busy === "photo";

  return (
    <section className="space-y-2">
      <label htmlFor="earn-say" className="block font-extrabold">
        {t("earn.say")}
      </label>
      <textarea
        id="earn-say"
        rows={3}
        maxLength={2000}
        value={text}
        onChange={(e) => onText(e.target.value)}
        placeholder={t("earn.say_ph")}
        className="w-full resize-none rounded-xl border-2 border-tarmac bg-paper px-3 py-2 text-lg outline-none focus:outline-3 focus:outline-strip"
      />
      <div className="flex flex-wrap gap-2">
        <MicButton value={text} onChange={onText} variant="pill" />
        <button
          type="button"
          disabled={!text.trim() || busy !== null}
          onClick={onParse}
          className="flex min-h-12 items-center gap-2 rounded-full bg-tarmac px-4 font-bold text-white active:opacity-80 disabled:opacity-40"
        >
          <Sparkles size={18} aria-hidden />
          {busy === "text" ? t("earn.reading") : t("earn.fill")}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => fileRef.current?.click()}
          className="flex min-h-12 items-center gap-2 rounded-full border-2 border-tarmac bg-paper px-4 font-bold active:bg-line disabled:opacity-40"
        >
          <Camera size={18} aria-hidden />
          {busy === "photo" ? t("earn.reading") : t("earn.photo")}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPhoto(file);
            e.target.value = ""; // allow choosing the same photo again
          }}
        />
      </div>

      {reading && <div className="road-dash" role="status" aria-label={t("earn.reading")} />}
      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={`rounded-xl border-2 p-3 font-bold ${notice.tone === "error" ? "border-signal text-signal" : "border-dashed border-tarmac"}`}
        >
          {t(notice.key)}
        </p>
      )}
      {question && (
        <p className="rounded-xl border-2 border-dashed border-tarmac p-3">
          <strong>{t("earn.ask")}: </strong>
          {question}
        </p>
      )}
    </section>
  );
}
