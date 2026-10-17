"use client";

import { Mic, Square } from "lucide-react";
import { useDictation } from "./useDictation";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/messages";

interface Props {
  value: string;
  onChange: (next: string) => void;
  variant?: "round" | "pill";
  className?: string;
}

const SHAPE = {
  round: "flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-tarmac active:opacity-80",
  pill: "flex min-h-12 items-center gap-2 rounded-full border-2 border-tarmac px-4 font-bold active:opacity-80",
};

/** The small bubble above the mic: "listening" while it hears you, or what went wrong. */
function DictationHint({ listening, error }: { listening: boolean; error: MessageKey | null }) {
  const { t } = useI18n();
  if (!listening && !error) return null;
  return (
    <div
      role={error ? "alert" : "status"}
      className="absolute bottom-full right-0 z-30 mb-2 w-max max-w-[16rem] rounded-xl bg-tarmac px-3 py-2 text-xs font-bold text-white shadow"
    >
      {error ? (
        t(error)
      ) : (
        <>
          <span className="block text-sm">{t("voice.listening")}</span>
          <span className="mt-0.5 block font-normal opacity-80">{t("voice.note")}</span>
        </>
      )}
    </div>
  );
}

/** A mic that types for you. Hidden where the browser cannot do speech recognition. */
export function MicButton({ value, onChange, variant = "round", className = "" }: Props) {
  const { t } = useI18n();
  const { supported, listening, error, toggle } = useDictation(value, onChange);
  if (!supported) return null;

  const label = listening ? t("chat.stop") : t("voice.speak");
  const Icon = listening ? Square : Mic;

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={listening}
        aria-label={label}
        className={`${SHAPE[variant]} ${listening ? "bg-signal text-white" : "bg-plate text-tarmac"}`}
      >
        <Icon size={variant === "round" ? 22 : 18} fill={listening ? "currentColor" : "none"} aria-hidden />
        {variant === "pill" && label}
      </button>

      <DictationHint listening={listening} error={error} />
    </div>
  );
}
