"use client";

import { Square, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { loadVoices, pickVoice, speak, stopSpeaking, supportsSpeechOutput } from "@/lib/voice/speech";

/** True when this phone has a voice for the language. Resolved after mount; false until then. */
export function useVoiceAvailable(lang: string): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!supportsSpeechOutput()) return;
    void loadVoices().then((voices) => {
      if (alive) setAvailable(pickVoice(voices, lang) !== null);
    });
    return () => {
      alive = false;
    };
  }, [lang]);
  return available;
}

/**
 * Reads text aloud. Hidden when the phone has no voice for the worker's language, because
 * reading Hindi or Tamil with an English voice sounds like noise and is worse than silence.
 */
export function SpeakButton({ text, className = "" }: { text: string; className?: string }) {
  const { t, speechLang } = useI18n();
  const available = useVoiceAvailable(speechLang);
  const [speaking, setSpeaking] = useState(false);

  // Stop if the screen goes away mid-sentence.
  useEffect(() => () => stopSpeaking(), []);

  if (!available || !text.trim()) return null;

  async function toggle() {
    if (speaking) {
      stopSpeaking();
      return;
    }
    setSpeaking(true);
    try {
      await speak(text, speechLang);
    } finally {
      setSpeaking(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-pressed={speaking}
      className={`flex min-h-11 items-center gap-1.5 rounded-full border-2 border-tarmac px-3 text-sm font-bold active:bg-line ${speaking ? "bg-plate" : "bg-paper"} ${className}`}
    >
      {speaking ? <Square size={15} fill="currentColor" aria-hidden /> : <Volume2 size={17} aria-hidden />}
      {speaking ? t("chat.stop") : t("voice.listen")}
    </button>
  );
}
