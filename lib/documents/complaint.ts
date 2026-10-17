import { parseAmount } from "../earnings/format";
import type { ComplaintPrefill } from "../handoff";
import type { NormalizedInsight } from "./insight";

/**
 * A complaint pre-filled from a paper the worker just had explained. A challan maps to the matching
 * complaint; for anything else the worker chooses the type. The description is the plain-language
 * explanation already shown on screen, so nothing is added that the worker has not seen.
 */
export function complaintPrefillFor(insight: NormalizedInsight): ComplaintPrefill {
  const amount = insight.amount ? parseAmount(insight.amount) : null;
  return {
    ...(insight.kind === "challan" && { issue: "challan" as const }),
    description: insight.what_is_this,
    ...(amount && amount > 0 && { amountInr: Math.round(amount) }),
  };
}

/** Papers about money or rights can lead to a complaint; an unreadable photo cannot. */
export const canComplainAbout = (insight: NormalizedInsight): boolean => insight.kind !== "unreadable";
