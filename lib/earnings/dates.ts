/**
 * Dates are stored as local "YYYY-MM-DD" strings. Never go through Date.toISOString():
 * it converts to UTC, which shifts the day for anyone working past midnight in India (UTC+5:30).
 */

const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isValidISODate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, days: number): string {
  const d = parseISODate(s);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

function utcDay(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole calendar days from a to b (b - a). Done in UTC so daylight-saving shifts cannot skew it. */
export function daysBetween(a: string, b: string): number {
  return Math.round((utcDay(b) - utcDay(a)) / 86_400_000);
}

export function todayISO(now: Date = new Date()): string {
  return toISODate(now);
}
