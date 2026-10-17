import { describe, expect, it } from "vitest";
import { canComplainAbout, complaintPrefillFor } from "./complaint";
import type { NormalizedInsight } from "./insight";

const insight = (over: Partial<NormalizedInsight> = {}): NormalizedInsight => ({
  kind: "challan",
  title: "Traffic challan",
  what_is_this: "This is a fine for a traffic rule.",
  what_it_wants: "Pay or contest it.",
  deadline: "",
  amount: "Rs 500",
  risks: [],
  next_steps: [],
  bring: [],
  scam_signs: false,
  needs_human_help: false,
  confidence: "high",
  related: [],
  ...over,
});

describe("complaintPrefillFor", () => {
  it("maps a challan to the challan complaint, with the amount and the worker's explanation", () => {
    expect(complaintPrefillFor(insight())).toEqual({ issue: "challan", description: "This is a fine for a traffic rule.", amountInr: 500 });
  });
  it("leaves the complaint type to the worker for other papers", () => {
    const p = complaintPrefillFor(insight({ kind: "platform_message", amount: "" }));
    expect(p).not.toHaveProperty("issue");
    expect(p.description).toBe("This is a fine for a traffic rule.");
    expect(p).not.toHaveProperty("amountInr");
  });
  it("ignores an amount it cannot read, instead of guessing one", () => {
    expect(complaintPrefillFor(insight({ amount: "see page 2" }))).not.toHaveProperty("amountInr");
    expect(complaintPrefillFor(insight({ amount: "Rs 0" }))).not.toHaveProperty("amountInr");
  });
});

describe("canComplainAbout", () => {
  it("is false only for an unreadable photo", () => {
    expect(canComplainAbout(insight({ kind: "unreadable" }))).toBe(false);
    for (const kind of ["challan", "notice", "platform_message", "insurance", "bank_or_payment", "contract", "other"] as const) {
      expect(canComplainAbout(insight({ kind }))).toBe(true);
    }
  });
});
