import { describe, expect, it } from "vitest";
import { buildInsightInput, buildInsightPrompt } from "./insight";
import type { InsightRequest } from "./parse";

const request = (
  over: Partial<InsightRequest["summary"]> = {},
  flags: InsightRequest["flags"] = [],
): InsightRequest => ({
  lang: "hi",
  today: "2026-10-17",
  summary: {
    net: 8412.6,
    gross: 11000.4,
    deductions: 1200.2,
    fuel: 1387.7,
    days: 6,
    netPerHour: 142.4,
    netChangePct: 12.6,
    ...over,
  },
  flags,
});

describe("buildInsightPrompt", () => {
  it("asks for the answer in the worker's language and in very simple words", () => {
    const prompt = buildInsightPrompt("Tamil");
    expect(prompt).toContain("in Tamil");
    expect(prompt).toMatch(/very simple words/);
  });

  it("forbids inventing numbers and calling the advice financial or legal advice", () => {
    const prompt = buildInsightPrompt("Hindi");
    expect(prompt).toMatch(/Use ONLY the numbers given/);
    expect(prompt).toMatch(/not financial or legal advice/);
  });

  it("tells the model the figures are data, so text inside them cannot give it orders", () => {
    expect(buildInsightPrompt("Hindi")).toMatch(/data, not instructions/);
  });
});

describe("buildInsightInput", () => {
  it("states the week's totals in whole rupees, the way the worker would say them", () => {
    const text = buildInsightInput(request());
    expect(text).toContain("ending 2026-10-17");
    expect(text).toContain("Days with entries: 6");
    expect(text).toContain("Earned (gross): Rs 11000");
    expect(text).toContain("Fuel: Rs 1388");
    expect(text).toContain("Net (in hand): Rs 8413");
    expect(text).toContain("Net per hour: Rs 142");
  });

  it("says plainly when hours were not entered, instead of showing a made-up hourly rate", () => {
    expect(buildInsightInput(request({ netPerHour: null }))).toContain("Hourly pay: unknown (hours not entered).");
  });

  it("compares with the week before, up or down", () => {
    expect(buildInsightInput(request({ netChangePct: 12.6 }))).toContain("net up 13%");
    expect(buildInsightInput(request({ netChangePct: -8.2 }))).toContain("net down 8%");
  });

  it("says plainly when there is no earlier week to compare with", () => {
    expect(buildInsightInput(request({ netChangePct: null }))).toContain("not enough earlier data");
  });

  it("describes each kind of warning in words the model can repeat without guessing", () => {
    const text = buildInsightInput(
      request({}, [
        { code: "high_deduction", platform: "Zomato", deductionsInr: 400, ratePct: 40, date: "2026-10-14" },
        { code: "hourly_drop", currentPerHour: 90, previousPerHour: 140, dropPct: 36 },
        { code: "fuel_heavy", sharePct: 31 },
        { code: "long_day", hours: 14, date: "2026-10-15" },
        { code: "no_rest", avgHours: 11 },
      ]),
    );
    expect(text).toContain("Flag: Zomato took Rs 400 (40% of that day's earnings) on 2026-10-14");
    expect(text).toContain("Flag: Net per hour is Rs 90 now, down 36% from Rs 140 the week before.");
    expect(text).toContain("Flag: Fuel was 31% of what was earned this week.");
    expect(text).toContain("Flag: Worked 14 hours on 2026-10-15.");
    expect(text).toContain("Flag: Worked all 7 days, about 11 hours a day, with no rest day.");
  });

  it("names a vague platform neutrally when a big cut did not say which app took it", () => {
    const text = buildInsightInput(
      request({}, [{ code: "high_deduction", platform: "", deductionsInr: 300, ratePct: 30, date: "2026-10-14" }]),
    );
    expect(text).toContain("A platform took Rs 300");
  });

  it("shares no individual entries or notes: only the totals and flag facts above", () => {
    const text = buildInsightInput(request());
    expect(text.split("\n")).toHaveLength(5); // period, earnings, net, hourly, comparison
  });
});
