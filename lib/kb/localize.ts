import type { LangCode } from "../i18n/messages";
import { acceptKbTranslation, type KbTranslation } from "../i18n/translate-utils";
import bn from "./data/i18n/bn.json";
import gu from "./data/i18n/gu.json";
import hi from "./data/i18n/hi.json";
import kn from "./data/i18n/kn.json";
import mr from "./data/i18n/mr.json";
import ta from "./data/i18n/ta.json";
import te from "./data/i18n/te.json";
import type { KbEntry } from "./types";

export type KbTables = Partial<Record<LangCode, Record<string, unknown>>>;

/**
 * Translations written by `npm run translate:kb`. Each file starts empty and fills in as
 * translations are generated and validated. English is the source and the fallback.
 */
const TABLES: KbTables = { bn, gu, hi, kn, mr, ta, te };

/**
 * The entry as the worker should read it. Only titles, summaries and step lists are swapped;
 * ids, status, source links, helplines and eligibility RULES stay exactly as in English.
 * Every field is re-checked here (numbers intact, same list length), so even a hand-edited
 * bad translation can only ever fall back to English, never show a wrong number.
 */
export function localizeEntry(entry: KbEntry, lang: LangCode, tables: KbTables = TABLES): KbEntry {
  if (lang === "en") return entry;
  const candidate = tables[lang]?.[entry.id];
  if (!candidate) return entry;
  const { accepted } = acceptKbTranslation(entry, candidate);
  return Object.keys(accepted).length ? { ...entry, ...(accepted as Partial<KbEntry>) } : entry;
}

/** For reports: how many entries have an accepted translation in each language. */
export function coverage(entries: readonly KbEntry[], lang: LangCode, tables: KbTables = TABLES): { translated: number; total: number } {
  const translated = entries.filter((e) => {
    const c = tables[lang]?.[e.id] as KbTranslation | undefined;
    return c && Object.keys(acceptKbTranslation(e, c).accepted).length > 0;
  }).length;
  return { translated, total: entries.length };
}
