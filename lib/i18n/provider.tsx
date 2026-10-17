"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LANG, LANGUAGES, isLangCode, translate, type LangCode, type MessageKey } from "./messages";

const STORAGE_KEY = "saathi.lang";

interface I18n {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  /** BCP-47 tag for speech recognition and synthesis. */
  speechLang: string;
}

const Ctx = createContext<I18n | null>(null);

function readStored(): LangCode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isLangCode(v) ? v : null;
  } catch {
    return null; // private mode or blocked storage: just use the default
  }
}

function detectFromBrowser(): LangCode | null {
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLangCode(base)) return base;
  }
  return null;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // The server and first client render both use DEFAULT_LANG so hydration matches.
  const [lang, setLangState] = useState<LangCode>(DEFAULT_LANG);

  useEffect(() => {
    const next = readStored() ?? detectFromBrowser() ?? DEFAULT_LANG;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- must wait for the browser to read the saved language
    setLangState(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: LangCode) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* not persisted; still works for this session */
    }
  }, []);

  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
      speechLang: LANGUAGES.find((l) => l.code === lang)?.speech ?? "hi-IN",
    }),
    [lang, setLang],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n must be used inside <I18nProvider>");
  return v;
}
