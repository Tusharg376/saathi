import { describe, expect, it } from "vitest";
import { inr, parseAmount, shortDate } from "./format";
import { flagMessage } from "./flags";
import { buildDashboard, toInsightRequest } from "./dashboard";
import { translate, type MessageKey } from "../i18n/messages";
import { InsightRequest } from "./parse";
import { addDays } from "./dates";
import type { Anomaly, EarningEntry } from "./math";

describe("inr", () => {
  it("uses Indian digit grouping", () => {
    expect(inr(0)).toBe("₹0");
    expect(inr(1850)).toBe("₹1,850");
    expect(inr(185000)).toBe("₹1,85,000");
    expect(inr(12345678)).toBe("₹1,23,45,678");
  });
  it("rounds and keeps the sign in front", () => {
    expect(inr(1850.6)).toBe("₹1,851");
    expect(inr(-200)).toBe("-₹200");
    expect(inr(-0.4)).toBe("₹0");
  });
});

describe("shortDate", () => {
  it("formats in the worker's locale", () => {
    expect(shortDate("2026-10-17", "en-IN")).toBe("17 Oct");
    expect(shortDate("2026-10-17", "hi-IN")).toMatch(/17/);
    expect(shortDate("2026-10-17", "hi-IN")).not.toMatch(/Oct/);
  });
  it("falls back to the raw value on a bad locale", () => {
    expect(shortDate("2026-10-17", "not a locale!!")).toBe("2026-10-17");
  });
});

describe("parseAmount", () => {
  it("reads what people really type", () => {
    expect(parseAmount("1850")).toBe(1850);
    expect(parseAmount("1,850")).toBe(1850);
    expect(parseAmount(" 1 850 ")).toBe(1850);
    expect(parseAmount("₹400")).toBe(400);
    expect(parseAmount("Rs. 400")).toBe(400);
    expect(parseAmount("1850.5")).toBe(1850.5);
    expect(parseAmount("0")).toBe(0);
  });
  it("rejects non-numbers instead of guessing", () => {
    for (const bad of ["", "   ", "abc", "12abc", "1.2.3", "-50", "1e3", "NaN", "Infinity"]) {
      expect(parseAmount(bad), bad).toBeNull();
    }
  });
});

describe("flagMessage", () => {
  const flags: Anomaly[] = [
    {
      code: "high_deduction",
      severity: "warn",
      date: "2026-10-17",
      platform: "Swiggy",
      deductionsInr: 400,
      ratePct: 40,
    },
    { code: "hourly_drop", severity: "warn", dropPct: 43, currentPerHour: 65, previousPerHour: 115 },
    { code: "fuel_heavy", severity: "info", sharePct: 45 },
    { code: "long_day", severity: "warn", date: "2026-10-16", hours: 13 },
    { code: "no_rest", severity: "warn", avgHours: 10.5 },
  ];

  for (const [lang, locale] of [
    ["en", "en-IN"],
    ["hi", "hi-IN"],
  ] as const) {
    it(`fills every placeholder in ${lang}`, () => {
      const t = (k: MessageKey, v?: Record<string, string | number>) => translate(lang, k, v);
      for (const f of flags) {
        const msg = flagMessage(f, t, locale);
        expect(msg, f.code).not.toMatch(/\{\w+\}/);
        expect(msg.length, f.code).toBeGreaterThan(15);
      }
    });
  }

  it("states the real numbers", () => {
    const t = (k: MessageKey, v?: Record<string, string | number>) => translate("en", k, v);
    expect(flagMessage(flags[0], t, "en-IN")).toMatch(/Swiggy took ₹400 \(40%\) on 17 Oct/);
    expect(flagMessage(flags[1], t, "en-IN")).toMatch(/₹65 an hour, down 43% from ₹115/);
  });

  it("writes the Hindi warning in Devanagari", () => {
    const t = (k: MessageKey, v?: Record<string, string | number>) => translate("hi", k, v);
    expect(flagMessage(flags[2], t, "hi-IN")).toMatch(/[ऀ-ॿ]/);
  });
});

describe("buildDashboard", () => {
  const TODAY = "2026-10-17";
  let id = 0;
  const e = (daysAgo: number, over: Partial<EarningEntry> = {}): EarningEntry => ({
    id: ++id,
    date: addDays(TODAY, -daysAgo),
    platform: "Swiggy",
    grossInr: 1000,
    deductionsInr: 100,
    fuelInr: 200,
    otherCostInr: 0,
    createdAt: 0,
    ...over,
  });

  it("is empty-safe", () => {
    const d = buildDashboard([], TODAY);
    expect(d.hasData).toBe(false);
    expect(d.today.net).toBe(0);
    expect(d.bars).toHaveLength(7);
    expect(d.flags).toEqual([]);
    expect(d.streak).toBe(0);
  });

  it("computes today separately from the week", () => {
    const d = buildDashboard([e(0), e(1), e(2)], TODAY);
    expect(d.today.net).toBe(700);
    expect(d.week.current.net).toBe(2100);
    expect(d.bars.at(-1)?.net).toBe(700);
    expect(d.streak).toBe(3);
    expect(d.hasData).toBe(true);
  });

  it("limits platform totals to the last 30 days", () => {
    const d = buildDashboard(
      [e(1, { platform: "Zomato", grossInr: 5000 }), e(45, { platform: "Old", grossInr: 9999 })],
      TODAY,
    );
    expect(d.platforms.map((p) => p.platform)).toEqual(["Zomato"]);
  });

  it("builds an aggregates-only insight request that passes validation", () => {
    const d = buildDashboard([e(0, { notes: "SECRET NOTE", hours: 8 }), e(1, { hours: 8 })], TODAY);
    const req = toInsightRequest(d, TODAY, "hi");
    expect(InsightRequest.safeParse(req).success).toBe(true);
    expect(JSON.stringify(req)).not.toMatch(/SECRET/);
    expect(req.summary.net).toBe(1400);
  });
});
