import type { KbEntry } from "../kb/types";

/**
 * Checks for machine-generated translations. A translation is only used if it passes: a
 * wrong number or a lost {placeholder} in a welfare scheme is worse than showing English.
 * Rejected items simply fall back to English, so a partly-bad run is still safe to ship.
 */

export interface Rejection {
  key: string;
  reason: string;
}

export const placeholdersOf = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

/** Numbers as written, e.g. "14434", "3,000", "18". They carry the facts, so they must survive translation. */
export const numbersOf = (s: string): string[] => s.match(/\d[\d,.]*\d|\d/g) ?? [];

/**
 * Digits must stay ASCII. A translation that turns "14434" into "१४४३४" fails this check, which
 * is what we want: a worker dialling a helpline needs the number they can see on the keypad.
 */
export function numbersPreserved(source: string, translated: string): boolean {
  return numbersOf(source).every((n) => translated.includes(n));
}

const tooLong = (source: string, translated: string) => translated.length > source.length * 4 + 60;

/* ------------------------------ UI strings ------------------------------ */

export function acceptUiTranslations(
  source: Record<string, string>,
  candidate: unknown,
): { accepted: Record<string, string>; rejected: Rejection[] } {
  const accepted: Record<string, string> = {};
  const rejected: Rejection[] = [];
  const obj = candidate && typeof candidate === "object" ? (candidate as Record<string, unknown>) : {};

  for (const [key, en] of Object.entries(source)) {
    const tr = obj[key];
    if (typeof tr !== "string" || !tr.trim()) {
      rejected.push({ key, reason: "missing or empty" });
    } else if (placeholdersOf(tr).join() !== placeholdersOf(en).join()) {
      rejected.push({
        key,
        reason: `placeholders differ (${placeholdersOf(en).join(",") || "none"} vs ${placeholdersOf(tr).join(",") || "none"})`,
      });
    } else if (!numbersPreserved(en, tr)) {
      rejected.push({ key, reason: "a number was changed or lost" });
    } else if (tooLong(en, tr)) {
      rejected.push({ key, reason: "suspiciously long" });
    } else {
      accepted[key] = tr.trim();
    }
  }
  return { accepted, rejected };
}

/* ----------------------------- Knowledge base ---------------------------- */

export const LIST_FIELDS = ["eligibility", "benefits", "how_to_apply", "documents_needed", "steps"] as const;

/** The only fields of a KB entry that are translated. Ids, status, links and helplines never change. */
export interface KbTranslation {
  title?: string;
  summary?: string;
  status_note?: string;
  eligibility?: string[];
  benefits?: string[];
  how_to_apply?: string[];
  documents_needed?: string[];
  steps?: string[];
}

type Check<T> = { ok: true; value: T } | { ok: false; reason: string };
const fail = (reason: string): { ok: false; reason: string } => ({ ok: false, reason });

/** A translated sentence is only used if it is non-empty, keeps every number, and is not runaway. */
function checkText(en: string | undefined, tr: string): Check<string> {
  if (!en) return fail("English has no such field");
  if (!tr.trim()) return fail("empty");
  if (!numbersPreserved(en, tr)) return fail("a number was changed or lost");
  if (tooLong(en, tr)) return fail("suspiciously long");
  return { ok: true, value: tr.trim() };
}

/** A translated list must line up item for item with the English, and each item must pass the same checks. */
function checkList(en: string[] | undefined, tr: string[]): Check<string[]> {
  if (!en) return fail("English has no such field");
  if (tr.length !== en.length) return fail(`has ${tr.length} items, English has ${en.length}`);
  if (tr.some((x) => !x.trim())) return fail("an item is empty");
  if (tr.some((x, i) => !numbersPreserved(en[i], x))) return fail("a number was changed or lost");
  if (tr.some((x, i) => tooLong(en[i], x))) return fail("suspiciously long");
  return { ok: true, value: tr.map((x) => x.trim()) };
}

const TEXT_FIELDS = ["title", "summary", "status_note"] as const;

const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/**
 * The translation as a typed object, or null if it is not shaped like one: an object whose known
 * fields are text or lists of text. Unknown keys are ignored. Written by hand instead of with the
 * schema library because this runs in the browser, and the library would add its full size to the app.
 */
function readTranslation(candidate: unknown): KbTranslation | null {
  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) return null;
  const c = candidate as Record<string, unknown>;
  const out: KbTranslation = {};
  for (const field of TEXT_FIELDS) {
    if (c[field] === undefined) continue;
    if (typeof c[field] !== "string") return null;
    out[field] = c[field];
  }
  for (const field of LIST_FIELDS) {
    if (c[field] === undefined) continue;
    if (!isStringList(c[field])) return null;
    out[field] = c[field];
  }
  return out;
}

export function acceptKbTranslation(
  entry: KbEntry,
  candidate: unknown,
): { accepted: KbTranslation; rejected: Rejection[] } {
  const c = readTranslation(candidate);
  if (!c) return { accepted: {}, rejected: [{ key: entry.id, reason: "not the expected shape" }] };

  const accepted: KbTranslation = {};
  const rejected: Rejection[] = [];

  for (const field of TEXT_FIELDS) {
    if (c[field] === undefined) continue;
    const r = checkText(entry[field], c[field]);
    if (r.ok) accepted[field] = r.value;
    else rejected.push({ key: `${entry.id}.${field}`, reason: r.reason });
  }
  for (const field of LIST_FIELDS) {
    if (c[field] === undefined) continue;
    const r = checkList(entry[field], c[field]);
    if (r.ok) accepted[field] = r.value;
    else rejected.push({ key: `${entry.id}.${field}`, reason: r.reason });
  }
  return { accepted, rejected };
}

/** Plain JSON object for the model: only the translatable fields that exist on this entry. */
export function translatableFields(entry: KbEntry): KbTranslation {
  const out: KbTranslation = { title: entry.title, summary: entry.summary };
  if (entry.status_note) out.status_note = entry.status_note;
  for (const f of LIST_FIELDS) if (entry[f]?.length) out[f] = [...(entry[f] as string[])];
  return out;
}

/** Splits keys into batches so one model call is never too large to answer reliably. */
export function batches<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
