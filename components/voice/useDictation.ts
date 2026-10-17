"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/messages";
import { appendDictation, startDictation, supportsSpeechInput, type Dictation, type DictationError } from "@/lib/voice/speech";

/** Errors worth telling the worker about. A silent pause ("no speech") is not one. */
const ERROR_KEY: Partial<Record<DictationError, MessageKey>> = {
  denied: "voice.err.denied",
  network: "voice.err.network",
  other: "voice.err.other",
};

/**
 * Speak instead of type. Spoken words are added after whatever is already typed, and stay editable.
 * `supported` is false on phones whose browser has no speech recognition: typing always works.
 */
export function useDictation(value: string, onChange: (next: string) => void) {
  const { speechLang } = useI18n();
  const supported = useSyncExternalStore(
    () => () => {},
    supportsSpeechInput,
    () => false, // the server cannot know, so nothing renders until the browser has checked
  );
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const session = useRef<Dictation | null>(null);

  // Stop listening if the screen goes away.
  useEffect(() => () => session.current?.stop(), []);

  const toggle = () => {
    if (listening) return session.current?.stop();

    setError(null);
    setListening(true);
    const typedBefore = value; // what was in the box before this utterance
    session.current = startDictation({
      lang: speechLang,
      onText: (spoken) => onChange(appendDictation(typedBefore, spoken)),
      onEnd: () => {
        setListening(false);
        session.current = null;
      },
      onError: (e) => {
        setListening(false);
        setError(ERROR_KEY[e] ?? null);
      },
    });
    if (!session.current) setListening(false);
  };

  return { supported, listening, error, toggle };
}
