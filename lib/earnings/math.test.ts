import { describe, expect, it } from "vitest";
import {
  THRESHOLDS,
  compareWeeks,
  currentStreak,
  dailyTotals,
  detectAnomalies,
  groupByPlatform,
  netOf,
  summarize,
  toCsv,
  type EarningEntry,
} from "./math";
import { addDays } from "./dates";

const TODAY = "2026-10-17";

let n = 0;
const entry = (over: Partial<EarningEntry> & { date: string }): EarningEntry => ({
  id: ++n,
  platform: "Swiggy",
  grossInr: 1000,
  deductionsInr: 0,
  fuelInr: 0,
  otherCostInr: 0,
  createdAt: 0,
  ...over,
});
/** An entry `daysAgo` days before TODAY. */
const ago = (daysAgo: number, over: Partial<EarningEntry> = {}) => entry({ date: addDays(TODAY, -daysAgo), ...over });

describe("netOf", () => {
  it("subtracts cuts, fuel and other costs from gross", () => {
    expect(netOf({ grossInr: 1850, deductionsInr: 150, fuelInr: 400, otherCostInr: 100 })).toBe(1200);
  });
  it("can be negative on a loss day", () => {
    expect(netOf({ grossInr: 300, deductionsInr: 0, fuelInr: 500, otherCostInr: 0 })).toBe(-200);
  });
});

describe("summarize", () => {
  it("handles no entries without dividing by zero", () => {
    const s = summarize([]);
    expect(s).toMatchObject({ entries: 0, days: 0, net: 0, gross: 0 });
    expect(s.netPerHour).toBeNull();
    expect(s.netPerKm).toBeNull();
    expect(s.netPerOrder).toBeNull();
    expect(s.deductionRate).toBeNull();
  });

  it("totals money and counts distinct days", () => {
    const s = summarize([
      ago(0, { grossInr: 1000, fuelInr: 200 }),
      ago(0, { grossInr: 500, deductionsInr: 50, platform: "Zomato" }),
      ago(1, { grossInr: 800, otherCostInr: 100 }),
    ]);
    expect(s).toMatchObject({ entries: 3, days: 2, gross: 2300, deductions: 50, fuel: 200, other: 100, net: 1950 });
  });

  it("computes per-hour pay only from entries that recorded hours", () => {
    // 1000 net over 5h = 200/h. The entry with no hours must not drag the rate down.
    const s = summarize([ago(0, { grossInr: 1000, hours: 5 }), ago(1, { grossInr: 5000 })]);
    expect(s.netPerHour).toBe(200);
  });

  it("computes per-km and per-order the same way", () => {
    const s = summarize([ago(0, { grossInr: 600, km: 30, orders: 10 })]);
    expect(s.netPerKm).toBe(20);
    expect(s.netPerOrder).toBe(60);
  });

  it("ignores zero or missing units", () => {
    expect(summarize([ago(0, { hours: 0 })]).netPerHour).toBeNull();
  });

  it("computes the deduction rate against gross", () => {
    expect(summarize([ago(0, { grossInr: 1000, deductionsInr: 250 })]).deductionRate).toBe(0.25);
  });
});

describe("dailyTotals", () => {
  it("returns exactly N consecutive days, zero-filled, ending today", () => {
    const rows = dailyTotals([ago(0, { grossInr: 900, fuelInr: 100 }), ago(2, { grossInr: 500 })], TODAY, 7);
    expect(rows).toHaveLength(7);
    expect(rows[6]).toEqual({ date: TODAY, net: 800, gross: 900 });
    expect(rows[4]).toEqual({ date: addDays(TODAY, -2), net: 500, gross: 500 });
    expect(rows[5]).toMatchObject({ net: 0, gross: 0 });
    expect(rows[0].date).toBe(addDays(TODAY, -6));
  });

  it("excludes entries outside the window", () => {
    const rows = dailyTotals([ago(10, { grossInr: 999 })], TODAY, 7);
    expect(rows.every((r) => r.net === 0)).toBe(true);
  });

  it("sums several entries on one day", () => {
    const rows = dailyTotals([ago(0, { grossInr: 100 }), ago(0, { grossInr: 200 })], TODAY, 3);
    expect(rows[2].net).toBe(300);
  });
});

describe("compareWeeks", () => {
  it("compares the last 7 days with the 7 before", () => {
    const es = [ago(0, { grossInr: 1200 }), ago(3, { grossInr: 800 }), ago(8, { grossInr: 1000 }), ago(12, { grossInr: 1000 })];
    const c = compareWeeks(es, TODAY);
    expect(c.current.net).toBe(2000);
    expect(c.previous.net).toBe(2000);
    expect(c.netChangePct).toBe(0);
  });

  it("reports a percentage drop", () => {
    const c = compareWeeks([ago(1, { grossInr: 750 }), ago(9, { grossInr: 1000 })], TODAY);
    expect(c.netChangePct).toBe(-25);
  });

  it("gives null instead of infinity when last week was empty", () => {
    const c = compareWeeks([ago(1, { grossInr: 750 })], TODAY);
    expect(c.netChangePct).toBeNull();
  });

  it("puts day 7 and day 8 in different windows", () => {
    const c = compareWeeks([ago(6, { grossInr: 100 }), ago(7, { grossInr: 900 })], TODAY);
    expect(c.current.net).toBe(100);
    expect(c.previous.net).toBe(900);
  });
});

describe("groupByPlatform", () => {
  it("groups case-insensitively and sorts by net", () => {
    const g = groupByPlatform([
      ago(0, { platform: "Swiggy", grossInr: 500 }),
      ago(1, { platform: "swiggy ", grossInr: 500 }),
      ago(2, { platform: "Zomato", grossInr: 2000 }),
    ]);
    expect(g.map((x) => x.platform)).toEqual(["Zomato", "Swiggy"]);
    expect(g[1].summary.net).toBe(1000);
  });
});

describe("detectAnomalies", () => {
  const steady = (days: number[], over: Partial<EarningEntry> = {}) =>
    days.map((d) => ago(d, { grossInr: 1000, deductionsInr: 80, hours: 8, ...over }));

  it("is quiet for an ordinary week", () => {
    expect(detectAnomalies(steady([0, 1, 2, 3, 4, 8, 9, 10, 11]), TODAY)).toEqual([]);
  });

  it("flags a cut far above the worker's usual rate", () => {
    const es = [...steady([1, 2, 3, 4, 5, 8, 9]), ago(0, { grossInr: 1000, deductionsInr: 400, hours: 8 })];
    const hits = detectAnomalies(es, TODAY).filter((a) => a.code === "high_deduction");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ code: "high_deduction", date: TODAY, deductionsInr: 400, ratePct: 40 });
  });

  it("does not flag a small cut even if the rate is high", () => {
    const es = [ago(0, { grossInr: 200, deductionsInr: 90 })];
    expect(detectAnomalies(es, TODAY).some((a) => a.code === "high_deduction")).toBe(false);
  });

  it("flags at most two cuts, largest first", () => {
    const es = [0, 1, 2].map((d, i) => ago(d, { grossInr: 1000, deductionsInr: 300 + i * 100 }));
    const hits = detectAnomalies(es, TODAY).filter((a) => a.code === "high_deduction");
    expect(hits).toHaveLength(2);
    expect((hits[0] as { deductionsInr: number }).deductionsInr).toBe(500);
  });

  it("flags a fall in hourly pay against last week", () => {
    // Each entry also loses Rs 80 to cuts over 8h: now (600-80)/8 = 65/h, before (1000-80)/8 = 115/h.
    // Drop = (115-65)/115 = 43.5%, reported as 43.
    const es = [...steady([0, 1, 2, 3], { grossInr: 600 }), ...steady([8, 9, 10, 11], { grossInr: 1000 })];
    const hit = detectAnomalies(es, TODAY).find((a) => a.code === "hourly_drop");
    expect(hit).toMatchObject({ code: "hourly_drop", dropPct: 43, currentPerHour: 65, previousPerHour: 115 });
  });

  it("does not compare hourly pay without enough days of data", () => {
    const es = [...steady([0, 1], { grossInr: 100 }), ...steady([8, 9], { grossInr: 1000 })];
    expect(detectAnomalies(es, TODAY).some((a) => a.code === "hourly_drop")).toBe(false);
  });

  it("ignores a small dip", () => {
    const es = [...steady([0, 1, 2, 3], { grossInr: 900 }), ...steady([8, 9, 10, 11], { grossInr: 1000 })];
    expect(detectAnomalies(es, TODAY).some((a) => a.code === "hourly_drop")).toBe(false);
  });

  it("flags fuel eating the week", () => {
    const es = steady([0, 1, 2], { grossInr: 1000, fuelInr: 450, deductionsInr: 0 });
    expect(detectAnomalies(es, TODAY).find((a) => a.code === "fuel_heavy")).toMatchObject({ sharePct: 45 });
  });

  it("does not judge fuel on a tiny week", () => {
    expect(detectAnomalies([ago(0, { grossInr: 300, fuelInr: 250 })], TODAY).some((a) => a.code === "fuel_heavy")).toBe(false);
  });

  it("nudges about a very long day", () => {
    const hit = detectAnomalies([ago(1, { hours: 13 })], TODAY).find((a) => a.code === "long_day");
    expect(hit).toMatchObject({ code: "long_day", hours: 13 });
  });

  it("nudges about seven heavy days with no rest", () => {
    const es = [0, 1, 2, 3, 4, 5, 6].map((d) => ago(d, { hours: 10.5 }));
    expect(detectAnomalies(es, TODAY).find((a) => a.code === "no_rest")).toMatchObject({ avgHours: 10.5 });
  });

  it("does not say 'no rest' if any day was skipped", () => {
    const es = [0, 1, 2, 3, 4, 5].map((d) => ago(d, { hours: 11 }));
    expect(detectAnomalies(es, TODAY).some((a) => a.code === "no_rest")).toBe(false);
  });

  it("exposes its thresholds so the UI and tests agree", () => {
    expect(THRESHOLDS.hourlyDropPct).toBe(20);
  });
});

describe("currentStreak", () => {
  it("counts consecutive days back from today", () => {
    expect(currentStreak([ago(0), ago(1), ago(2), ago(4)], TODAY)).toBe(3);
  });
  it("still counts if the worker has not logged today yet", () => {
    expect(currentStreak([ago(1), ago(2)], TODAY)).toBe(2);
  });
  it("is zero after a gap", () => {
    expect(currentStreak([ago(3)], TODAY)).toBe(0);
    expect(currentStreak([], TODAY)).toBe(0);
  });
});

describe("toCsv", () => {
  it("writes a header, one row per entry, sorted by date, with net", () => {
    const csv = toCsv([ago(0, { grossInr: 1000, fuelInr: 100 }), ago(1, { grossInr: 500 })]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("date,platform,gross_inr,deductions_inr,fuel_inr,other_cost_inr,net_inr,orders,hours,km,notes");
    expect(lines).toHaveLength(3);
    expect(lines[1].startsWith(addDays(TODAY, -1))).toBe(true);
    expect(lines[2]).toContain(",900,");
  });

  it("quotes commas, quotes and newlines", () => {
    const csv = toCsv([ago(0, { notes: 'rain, "heavy"\nlate' })]);
    expect(csv).toContain('"rain, ""heavy""\nlate"');
  });

  it("neutralises spreadsheet formula injection in free text", () => {
    const csv = toCsv([ago(0, { platform: "=HYPERLINK(\"http://evil\")", notes: "+1+1" })]);
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+1+1");
  });

  it("does not corrupt negative numbers", () => {
    const csv = toCsv([ago(0, { grossInr: 100, fuelInr: 300 })]);
    expect(csv).toContain(",-200,");
    expect(csv).not.toContain("'-200");
  });
});
