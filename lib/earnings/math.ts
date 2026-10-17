import { addDays } from "./dates";

/**
 * Earnings math. Pure and deterministic: the AI explains these numbers in the
 * worker's language but never computes them.
 *
 *   net = gross - platform deductions - fuel - other costs
 */

export interface EarningEntry {
  id?: number;
  /** Local date, "YYYY-MM-DD". */
  date: string;
  platform: string;
  /** Total earned, as the app showed it, before cuts. */
  grossInr: number;
  /** Cuts, fees and penalties the platform took out. */
  deductionsInr: number;
  fuelInr: number;
  /** Repairs, parking, mobile data, anything else spent to earn. */
  otherCostInr: number;
  orders?: number;
  hours?: number;
  km?: number;
  notes?: string;
  createdAt: number;
}

export type NewEntry = Omit<EarningEntry, "id" | "createdAt">;

export const netOf = (e: Pick<EarningEntry, "grossInr" | "deductionsInr" | "fuelInr" | "otherCostInr">): number =>
  e.grossInr - e.deductionsInr - e.fuelInr - e.otherCostInr;

export interface Summary {
  entries: number;
  days: number;
  gross: number;
  deductions: number;
  fuel: number;
  other: number;
  net: number;
  hours: number;
  orders: number;
  km: number;
  /** Computed only from entries that recorded hours, so missing data does not skew the rate. */
  netPerHour: number | null;
  netPerKm: number | null;
  netPerOrder: number | null;
  /** deductions / gross, 0 to 1. */
  deductionRate: number | null;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Net per unit, using only entries that actually recorded that unit. */
function ratePer(entries: EarningEntry[], unit: "hours" | "km" | "orders"): number | null {
  const withUnit = entries.filter((e) => (e[unit] ?? 0) > 0);
  const units = sum(withUnit.map((e) => e[unit] as number));
  if (units <= 0) return null;
  return sum(withUnit.map(netOf)) / units;
}

export function summarize(entries: EarningEntry[]): Summary {
  const gross = sum(entries.map((e) => e.grossInr));
  const deductions = sum(entries.map((e) => e.deductionsInr));
  return {
    entries: entries.length,
    days: new Set(entries.map((e) => e.date)).size,
    gross,
    deductions,
    fuel: sum(entries.map((e) => e.fuelInr)),
    other: sum(entries.map((e) => e.otherCostInr)),
    net: sum(entries.map(netOf)),
    hours: sum(entries.map((e) => e.hours ?? 0)),
    orders: sum(entries.map((e) => e.orders ?? 0)),
    km: sum(entries.map((e) => e.km ?? 0)),
    netPerHour: ratePer(entries, "hours"),
    netPerKm: ratePer(entries, "km"),
    netPerOrder: ratePer(entries, "orders"),
    deductionRate: gross > 0 ? deductions / gross : null,
  };
}

export function inRange(entries: EarningEntry[], from: string, to: string): EarningEntry[] {
  // ISO dates compare correctly as strings.
  return entries.filter((e) => e.date >= from && e.date <= to);
}

export interface DayTotal {
  date: string;
  net: number;
  gross: number;
}

/** One row per calendar day ending at `to`, zero-filled so charts never skip days. */
export function dailyTotals(entries: EarningEntry[], to: string, days: number): DayTotal[] {
  const from = addDays(to, -(days - 1));
  const byDate = new Map<string, DayTotal>();
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i);
    byDate.set(d, { date: d, net: 0, gross: 0 });
  }
  for (const e of inRange(entries, from, to)) {
    const row = byDate.get(e.date)!;
    row.net += netOf(e);
    row.gross += e.grossInr;
  }
  return [...byDate.values()];
}

export interface WeekComparison {
  current: Summary;
  previous: Summary;
  /** Percentage change in net, or null when the previous week has no earnings to compare. */
  netChangePct: number | null;
  perHourChangePct: number | null;
}

/** Last 7 days (today included) against the 7 days before that. */
export function compareWeeks(entries: EarningEntry[], today: string): WeekComparison {
  const current = summarize(inRange(entries, addDays(today, -6), today));
  const previous = summarize(inRange(entries, addDays(today, -13), addDays(today, -7)));
  const pct = (a: number | null, b: number | null) => (a === null || b === null || b === 0 ? null : ((a - b) / Math.abs(b)) * 100);
  return {
    current,
    previous,
    netChangePct: previous.net > 0 ? pct(current.net, previous.net) : null,
    perHourChangePct: pct(current.netPerHour, previous.netPerHour),
  };
}

export function groupByPlatform(entries: EarningEntry[]): { platform: string; summary: Summary }[] {
  const groups = new Map<string, EarningEntry[]>();
  for (const e of entries) {
    const key = e.platform.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  return [...groups.entries()]
    .map(([, es]) => ({ platform: es[0].platform.trim(), summary: summarize(es) }))
    .sort((a, b) => b.summary.net - a.summary.net);
}

/* ------------------------------------------------------------------ */
/* Anomalies: things worth a second look. Deterministic and explainable */
/* ------------------------------------------------------------------ */

export const THRESHOLDS = {
  /** A cut is flagged if it is at least this share of gross AND at least 2x the worker's usual rate. */
  minDeductionRate: 0.2,
  minDeductionInr: 100,
  /** net per hour must fall by this much against the previous week to be flagged. */
  hourlyDropPct: 20,
  /** minimum entries with hours in each window before comparing hourly pay. */
  minDaysForHourly: 3,
  fuelShare: 0.35,
  minGrossForFuel: 1000,
  longDayHours: 12,
  noRestAvgHours: 10,
} as const;

export type Anomaly =
  | { code: "high_deduction"; severity: "warn"; date: string; platform: string; deductionsInr: number; ratePct: number }
  | { code: "hourly_drop"; severity: "warn"; dropPct: number; currentPerHour: number; previousPerHour: number }
  | { code: "fuel_heavy"; severity: "info"; sharePct: number }
  | { code: "long_day"; severity: "warn"; date: string; hours: number }
  | { code: "no_rest"; severity: "warn"; avgHours: number };

const median = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/** Each rule looks at the same window of entries and returns the warnings it finds, possibly none. */
interface Windows {
  all: EarningEntry[];
  today: string;
  last7: EarningEntry[];
  last14: EarningEntry[];
}
type Rule = (w: Windows) => Anomaly[];

const daysWithHours = (es: EarningEntry[]) => es.filter((e) => (e.hours ?? 0) > 0).length;

/** Unusually large cuts, judged against the worker's own usual rate rather than a fixed idea of "fair". */
const largeCuts: Rule = ({ all, last14 }) => {
  const rates = all.filter((e) => e.grossInr > 0).map((e) => e.deductionsInr / e.grossInr);
  const usual = rates.length >= 4 ? median(rates) : 0;
  const cutoff = Math.max(THRESHOLDS.minDeductionRate, usual * 2);

  return last14
    .filter((e) => e.grossInr > 0 && e.deductionsInr >= THRESHOLDS.minDeductionInr && e.deductionsInr / e.grossInr >= cutoff)
    .sort((a, b) => b.deductionsInr - a.deductionsInr)
    .slice(0, 2)
    .map((e) => ({
      code: "high_deduction" as const,
      severity: "warn" as const,
      date: e.date,
      platform: e.platform,
      deductionsInr: e.deductionsInr,
      ratePct: Math.round((e.deductionsInr / e.grossInr) * 100),
    }));
};

/** Pay per hour falling against the week before. Needs enough days with hours in both weeks to mean anything. */
const hourlyDrop: Rule = ({ all, today, last7 }) => {
  const { current, previous, perHourChangePct } = compareWeeks(all, today);
  const prevWeek = inRange(all, addDays(today, -13), addDays(today, -7));
  const enoughData =
    daysWithHours(last7) >= THRESHOLDS.minDaysForHourly && daysWithHours(prevWeek) >= THRESHOLDS.minDaysForHourly;
  const nowPerHour = current.netPerHour;
  const beforePerHour = previous.netPerHour;

  if (!enoughData || nowPerHour === null || beforePerHour === null || beforePerHour <= 0) return [];
  if (perHourChangePct === null || perHourChangePct > -THRESHOLDS.hourlyDropPct) return [];
  return [
    {
      code: "hourly_drop",
      severity: "warn",
      dropPct: Math.round(-perHourChangePct),
      currentPerHour: Math.round(nowPerHour),
      previousPerHour: Math.round(beforePerHour),
    },
  ];
};

/** Fuel eating a large share of the week's earnings. */
const fuelHeavy: Rule = ({ last7 }) => {
  const week = summarize(last7);
  if (week.gross < THRESHOLDS.minGrossForFuel || week.fuel / week.gross < THRESHOLDS.fuelShare) return [];
  return [{ code: "fuel_heavy", severity: "info", sharePct: Math.round((week.fuel / week.gross) * 100) }];
};

/** Safety nudge: the longest day this week, if it was very long. Gentle: a nudge, not a rule. */
const longDay: Rule = ({ last7 }) => {
  const longest = [...last7].sort((a, b) => (b.hours ?? 0) - (a.hours ?? 0))[0];
  if (!longest || (longest.hours ?? 0) < THRESHOLDS.longDayHours) return [];
  return [{ code: "long_day", severity: "warn", date: longest.date, hours: longest.hours as number }];
};

/** Safety nudge: all seven days worked, with long hours on average and no rest day. */
const noRest: Rule = ({ last7 }) => {
  const days = [...new Set(last7.map((e) => e.date))];
  const hours = days.map((d) => sum(last7.filter((e) => e.date === d).map((e) => e.hours ?? 0)));
  if (days.length < 7 || hours.some((h) => h <= 0)) return [];

  const avg = sum(hours) / 7;
  return avg >= THRESHOLDS.noRestAvgHours ? [{ code: "no_rest", severity: "warn", avgHours: Math.round(avg * 10) / 10 }] : [];
};

const RULES: Rule[] = [largeCuts, hourlyDrop, fuelHeavy, longDay, noRest];

export function detectAnomalies(entries: EarningEntry[], today: string): Anomaly[] {
  const windows: Windows = {
    all: entries,
    today,
    last7: inRange(entries, addDays(today, -6), today),
    last14: inRange(entries, addDays(today, -13), today),
  };
  return RULES.flatMap((rule) => rule(windows));
}

/** Streak of consecutive days with at least one entry, counting back from today (or yesterday). */
export function currentStreak(entries: EarningEntry[], today: string): number {
  const days = new Set(entries.map((e) => e.date));
  let cursor = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/* ------------------------------------------------------------------ */
/* CSV export                                                           */
/* ------------------------------------------------------------------ */

/**
 * Cells starting with = + - @ are executed as formulas by spreadsheet apps. The platform
 * and notes fields are free text, so a shared CSV could run a formula on someone else's
 * machine. Prefix with an apostrophe to force text.
 */
function csvCell(v: string | number | undefined): string {
  let s = v === undefined ? "" : String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(entries: EarningEntry[]): string {
  const header = ["date", "platform", "gross_inr", "deductions_inr", "fuel_inr", "other_cost_inr", "net_inr", "orders", "hours", "km", "notes"];
  const rows = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) =>
      [e.date, e.platform, e.grossInr, e.deductionsInr, e.fuelInr, e.otherCostInr, netOf(e), e.orders, e.hours, e.km, e.notes].map(csvCell).join(","),
    );
  return [header.join(","), ...rows].join("\r\n");
}
