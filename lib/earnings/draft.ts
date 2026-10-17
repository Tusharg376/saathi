import { daysBetween, isValidISODate } from "./dates";
import { parseAmount } from "./format";
import type { NewEntry } from "./math";

/** What the form holds while someone is typing: everything is a string. */
export interface Draft {
  date: string;
  platform: string;
  gross: string;
  cuts: string;
  fuel: string;
  other: string;
  orders: string;
  hours: string;
  km: string;
}

export type DraftField = keyof Draft | "amounts";
export type DraftError = "number" | "date" | "future" | "range" | "none";

export const emptyDraft = (today: string): Draft => ({
  date: today,
  platform: "",
  gross: "",
  cuts: "",
  fuel: "",
  other: "",
  orders: "",
  hours: "",
  km: "",
});

const str = (n: number | undefined) => (n === undefined || n === 0 ? "" : String(n));

export function draftFromEntry(e: NewEntry): Draft {
  return {
    date: e.date,
    platform: e.platform,
    gross: str(e.grossInr),
    cuts: str(e.deductionsInr),
    fuel: str(e.fuelInr),
    other: str(e.otherCostInr),
    orders: str(e.orders),
    hours: str(e.hours),
    km: str(e.km),
  };
}

export type DraftResult =
  { ok: true; entry: NewEntry } | { ok: false; errors: Partial<Record<DraftField, DraftError>> };

const MAX_MONEY = 200_000;

type NumericField = "gross" | "cuts" | "fuel" | "other" | "orders" | "hours" | "km";

/** The limits of each numeric box. Orders are a whole number; the rest may have decimals. */
const NUMERIC: Record<NumericField, { max: number; whole?: boolean }> = {
  gross: { max: MAX_MONEY },
  cuts: { max: MAX_MONEY },
  fuel: { max: MAX_MONEY },
  other: { max: MAX_MONEY },
  orders: { max: 500, whole: true },
  hours: { max: 24 },
  km: { max: 1000 },
};

/** Blank means zero. Anything typed that is not a number is an error, never silently zero. */
function readNumber(
  raw: string,
  { max, whole }: { max: number; whole?: boolean },
): { value: number } | { error: DraftError } {
  const text = raw.trim();
  if (text === "") return { value: 0 };
  const n = parseAmount(text);
  if (n === null) return { error: "number" };
  if (n > max || (whole && !Number.isInteger(n))) return { error: "range" };
  return { value: n };
}

function checkDate(date: string, today: string): DraftError | undefined {
  if (!isValidISODate(date)) return "date";
  return daysBetween(date, today) < 0 ? "future" : undefined;
}

type Numbers = Record<NumericField, number>;

/** Reads every numeric box. A box with an error counts as zero so the other checks can still run. */
function readNumbers(d: Draft): { n: Numbers; errors: DraftErrors } {
  const n = {} as Numbers;
  const errors: DraftErrors = {};
  for (const field of Object.keys(NUMERIC) as NumericField[]) {
    const read = readNumber(d[field], NUMERIC[field]);
    if ("error" in read) errors[field] = read.error;
    n[field] = "error" in read ? 0 : read.value;
  }
  return { n, errors };
}

function entryFrom(d: Draft, n: Numbers): NewEntry {
  return {
    date: d.date,
    platform: d.platform.trim().slice(0, 40) || "Other",
    grossInr: Math.round(n.gross),
    deductionsInr: Math.round(n.cuts),
    fuelInr: Math.round(n.fuel),
    otherCostInr: Math.round(n.other),
    ...(n.orders > 0 && { orders: n.orders }),
    ...(n.hours > 0 && { hours: Math.round(n.hours * 10) / 10 }),
    ...(n.km > 0 && { km: Math.round(n.km) }),
  };
}

export function validateDraft(d: Draft, today: string): DraftResult {
  const { n, errors } = readNumbers(d);

  const dateError = checkDate(d.date, today);
  if (dateError) errors.date = dateError;

  const moneyOk = !errors.gross && !errors.cuts && !errors.fuel && !errors.other;
  if (moneyOk && n.gross + n.cuts + n.fuel + n.other === 0) errors.amounts = "none";

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, entry: entryFrom(d, n) };
}

export type DraftErrors = Partial<Record<DraftField, DraftError>>;

export type DraftsResult = { ok: true; entries: NewEntry[] } | { ok: false; errors: DraftErrors[] };

/** Checks every form at once, so the worker sees all the problems together, not one per tap. */
export function validateDrafts(drafts: Draft[], today: string): DraftsResult {
  const results = drafts.map((d) => validateDraft(d, today));
  const entries: NewEntry[] = [];
  const errors: DraftErrors[] = [];
  let invalid = false;

  for (const r of results) {
    if (r.ok) {
      entries.push(r.entry);
      errors.push({});
    } else {
      invalid = true;
      errors.push(r.errors);
    }
  }
  return invalid ? { ok: false, errors } : { ok: true, entries };
}
