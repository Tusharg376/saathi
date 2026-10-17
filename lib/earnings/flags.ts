import { letterDate } from "../grievance/share";
import type { ComplaintPrefill } from "../handoff";
import type { MessageKey } from "../i18n/messages";
import { parseISODate } from "./dates";
import { inr, shortDate } from "./format";
import type { Anomaly } from "./math";

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

/**
 * Turns an anomaly into a sentence in the worker's language from a fixed template.
 * Deliberately not an AI call: the warning must be instant, free, offline and exactly right.
 */
export function flagMessage(a: Anomaly, t: T, locale: string): string {
  switch (a.code) {
    case "high_deduction":
      return t("earn.flag.high_deduction", {
        platform: a.platform,
        amount: inr(a.deductionsInr),
        pct: a.ratePct,
        date: shortDate(a.date, locale),
      });
    case "hourly_drop":
      return t("earn.flag.hourly_drop", { now: inr(a.currentPerHour), before: inr(a.previousPerHour), pct: a.dropPct });
    case "fuel_heavy":
      return t("earn.flag.fuel_heavy", { pct: a.sharePct });
    case "long_day":
      return t("earn.flag.long_day", { hours: a.hours, date: shortDate(a.date, locale) });
    case "no_rest":
      return t("earn.flag.no_rest", { hours: a.avgHours });
  }
}

/**
 * A warning that can become a complaint. Only an unusually large platform cut qualifies: the
 * other warnings (long hours, fuel share) are about the worker, not something to complain about.
 * The description states only what the worker's own entries show; nothing is assumed.
 */
export function complaintPrefillFor(a: Anomaly): ComplaintPrefill | null {
  if (a.code !== "high_deduction") return null;
  const date = letterDate(parseISODate(a.date));
  return {
    issue: "penalty",
    party: a.platform,
    dates: date,
    amountInr: a.deductionsInr,
    description: `On ${date}, ${a.platform} deducted Rs ${a.deductionsInr} from my earnings. That is ${a.ratePct}% of what I earned that day, much more than usual. I would like to know the reason for this deduction.`,
  };
}
