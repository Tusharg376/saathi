import { parseISODate } from "./dates";

const INR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Rupees with Indian digit grouping: 185000 -> "₹1,85,000". Negatives keep the sign in front. */
export function inr(n: number): string {
  const r = Math.round(n);
  return `${r < 0 ? "-" : ""}₹${INR.format(Math.abs(r))}`;
}

/** "17 Oct" in the worker's own language and script (locale like "hi-IN"). */
export function shortDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(parseISODate(iso));
  } catch {
    return iso;
  }
}

/** Accepts what people actually type: "1,850", "1850.5", " 1 850 ", "₹400". Returns null if not a number. */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, "").replace(/^rs\.?/i, "");
  if (cleaned === "") return null;
  if (!/^\d*\.?\d+$/.test(cleaned) && !/^\d+\.?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
