import { addDays } from "./dates";
import { compareWeeks, currentStreak, dailyTotals, detectAnomalies, groupByPlatform, inRange, summarize } from "./math";
import type { Anomaly, DayTotal, EarningEntry, Summary, WeekComparison } from "./math";
import type { InsightRequest } from "./parse";

export interface Dashboard {
  today: Summary;
  week: WeekComparison;
  /** Last 7 days, zero-filled, oldest first. */
  bars: DayTotal[];
  flags: Anomaly[];
  streak: number;
  /** Per-platform totals over the last 30 days, best first. */
  platforms: ReturnType<typeof groupByPlatform>;
  hasData: boolean;
}

/** Everything the earnings screen shows, derived from raw entries. No UI, no AI. */
export function buildDashboard(entries: EarningEntry[], today: string): Dashboard {
  return {
    today: summarize(inRange(entries, today, today)),
    week: compareWeeks(entries, today),
    bars: dailyTotals(entries, today, 7),
    flags: detectAnomalies(entries, today),
    streak: currentStreak(entries, today),
    platforms: groupByPlatform(inRange(entries, addDays(today, -29), today)),
    hasData: entries.length > 0,
  };
}

/** Aggregates-only payload for the "explain my week" call. Raw entries and notes never leave the device. */
export function toInsightRequest(d: Dashboard, today: string, lang: InsightRequest["lang"]): InsightRequest {
  const s = d.week.current;
  return {
    lang,
    today,
    summary: {
      net: s.net,
      gross: s.gross,
      deductions: s.deductions,
      fuel: s.fuel,
      days: s.days,
      netPerHour: s.netPerHour,
      netChangePct: d.week.netChangePct,
    },
    flags: d.flags,
  };
}
