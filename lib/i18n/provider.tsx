"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LANG, LANGUAGES, isLangCode, translate, type LangCode, type MessageKey } from "./messages";
import { LANG_COOKIE } from "./pick-language";

/** The same name is used on this phone (localStorage) and in the cookie the server reads. */
const STORAGE_KEY = LANG_COOKIE;
const ONE_YEAR = 60 * 60 * 24 * 365;

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

/** Lets the server know the choice, so the next visit's first page is already in this language. */
function rememberForServer(l: LangCode): void {
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${STORAGE_KEY}=${l}; path=/; max-age=${ONE_YEAR}; samesite=lax${secure}`;
}

interface Props {
  children: ReactNode;
  /** The language the server wrote the page in. Starting from it keeps hydration identical to that HTML. */
  serverLang?: LangCode;
}

export function I18nProvider({ children, serverLang }: Props) {
  // The server render and the first client render must match, so both start from the same language.
  const [lang, setLangState] = useState<LangCode>(serverLang ?? DEFAULT_LANG);

  useEffect(() => {
    const stored = readStored();
    // A choice made before the server could see it (an older visit) is passed on now.
    if (stored) rememberForServer(stored);
    const next = stored ?? serverLang ?? detectFromBrowser() ?? DEFAULT_LANG;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- must wait for the browser to read the saved language
    setLangState(next);
  }, [serverLang]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: LangCode) => {
    setLangState(l);
    rememberForServer(l);
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
