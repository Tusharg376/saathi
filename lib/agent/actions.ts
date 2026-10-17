import { z } from "zod";
import { normalizeParsed } from "../earnings/parse";
import { ISSUES } from "../grievance/letter";
import type { ChatAction } from "./events";

/**
 * Arguments of the two "propose" tools. The model only SUGGESTS: the tools save and send
 * nothing, and the worker confirms on screen. Money fields are plain numbers so the schema
 * stays simple for the model; clamping happens in toChatAction.
 */
export const ProposeEarningArgs = z.object({
  platform: z.string().describe("The app or kind of work, e.g. Swiggy, Uber, Daily wage."),
  grossInr: z.number().min(0).describe("Total earned in rupees, as the worker said it."),
  deductionsInr: z.number().min(0).optional().describe("Cuts or penalties by the platform, if mentioned."),
  fuelInr: z.number().min(0).optional().describe("Fuel cost, if mentioned."),
  otherCostInr: z.number().min(0).optional().describe("Other spending to earn, if mentioned."),
  orders: z.number().int().min(0).optional().describe("Number of orders or trips, if mentioned."),
  hours: z.number().min(0).optional().describe("Hours worked, if mentioned."),
  km: z.number().min(0).optional().describe("Kilometres driven, if mentioned."),
  date: z.string().optional().describe("YYYY-MM-DD. Leave out for today."),
});

export const ProposeComplaintArgs = z.object({
  issue: z.enum(ISSUES).describe("The kind of problem."),
  summary: z.string().min(10).max(600).describe("What happened, in the worker's own words, kept short."),
  party: z.string().max(80).optional().describe("The platform, employer or contractor, if named."),
});

export const PROPOSE_EARNING = "propose_log_earning";
export const PROPOSE_COMPLAINT = "propose_complaint";

/**
 * Turns a validated tool call into the action the UI shows, or null if there is nothing sensible
 * to show. Amounts and dates go through the same clamping and repair as the earnings parser.
 */
export function toChatAction(name: string, args: unknown, today: string): ChatAction | null {
  if (name === PROPOSE_EARNING) {
    const a = ProposeEarningArgs.parse(args);
    const { entries } = normalizeParsed(
      {
        entries: [
          {
            date: a.date ?? today,
            platform: a.platform,
            grossInr: a.grossInr,
            deductionsInr: a.deductionsInr ?? 0,
            fuelInr: a.fuelInr ?? 0,
            otherCostInr: a.otherCostInr ?? 0,
            orders: a.orders ?? 0,
            hours: a.hours ?? 0,
            km: a.km ?? 0,
          },
        ],
        question: "",
      },
      today,
    );
    return entries[0] ? { kind: "log_earning", entry: entries[0] } : null;
  }

  if (name === PROPOSE_COMPLAINT) {
    const a = ProposeComplaintArgs.parse(args);
    return { kind: "start_complaint", issue: a.issue, summary: a.summary, ...(a.party && { party: a.party }) };
  }
  return null;
}
