import { describe, expect, it } from "vitest";
import { PROPOSE_COMPLAINT, PROPOSE_EARNING, ProposeComplaintArgs, ProposeEarningArgs, toChatAction } from "./actions";

const TODAY = "2026-10-17";

describe("toChatAction: earnings", () => {
  it("turns the worker's words into a normalised entry for them to confirm", () => {
    const a = toChatAction(PROPOSE_EARNING, { platform: "Swiggy", grossInr: 1850, fuelInr: 400, orders: 12 }, TODAY);
    expect(a).toEqual({
      kind: "log_earning",
      entry: {
        date: TODAY,
        platform: "Swiggy",
        grossInr: 1850,
        deductionsInr: 0,
        fuelInr: 400,
        otherCostInr: 0,
        orders: 12,
      },
    });
  });

  it("uses a stated date, and repairs a wrong one to today rather than filing money on the wrong day", () => {
    expect(
      toChatAction(PROPOSE_EARNING, { platform: "Zomato", grossInr: 900, date: "2026-10-16" }, TODAY),
    ).toMatchObject({
      entry: { date: "2026-10-16" },
    });
    for (const date of ["2030-01-01", "kal", "2026-02-30"]) {
      expect(toChatAction(PROPOSE_EARNING, { platform: "Zomato", grossInr: 900, date }, TODAY)).toMatchObject({
        entry: { date: TODAY },
      });
    }
  });

  it("clamps absurd amounts the same way the parser does", () => {
    const a = toChatAction(PROPOSE_EARNING, { platform: "X", grossInr: 99_999_999 }, TODAY);
    expect(a).toMatchObject({ entry: { grossInr: 200_000 } });
  });

  it("proposes nothing when every amount is zero", () => {
    expect(toChatAction(PROPOSE_EARNING, { platform: "Swiggy", grossInr: 0 }, TODAY)).toBeNull();
  });

  it("refuses malformed arguments instead of proposing something wrong", () => {
    expect(() => toChatAction(PROPOSE_EARNING, { platform: "Swiggy", grossInr: "lots" }, TODAY)).toThrow();
  });
});

describe("toChatAction: complaints", () => {
  it("passes the issue, the worker's summary and the party through", () => {
    expect(
      toChatAction(
        PROPOSE_COMPLAINT,
        { issue: "short_payment", summary: "Swiggy did not pay me for 12 October.", party: "Swiggy" },
        TODAY,
      ),
    ).toEqual({
      kind: "start_complaint",
      issue: "short_payment",
      summary: "Swiggy did not pay me for 12 October.",
      party: "Swiggy",
    });
  });

  it("omits the party when none was named", () => {
    const a = toChatAction(
      PROPOSE_COMPLAINT,
      { issue: "penalty", summary: "They cut Rs 400 and I do not know why." },
      TODAY,
    );
    expect(a).not.toHaveProperty("party");
  });
});

describe("toChatAction: unknown", () => {
  it("returns null for a tool that is not an action", () => {
    expect(toChatAction("search_kb", {}, TODAY)).toBeNull();
  });
});

describe("argument schemas", () => {
  it("only accept real complaint types, and bound the free text", () => {
    expect(ProposeComplaintArgs.safeParse({ issue: "revenge", summary: "x".repeat(20) }).success).toBe(false);
    expect(ProposeComplaintArgs.safeParse({ issue: "penalty", summary: "short" }).success).toBe(false);
    expect(ProposeComplaintArgs.safeParse({ issue: "penalty", summary: "x".repeat(601) }).success).toBe(false);
  });
  it("reject negative money", () => {
    expect(ProposeEarningArgs.safeParse({ platform: "X", grossInr: -1 }).success).toBe(false);
  });
});
