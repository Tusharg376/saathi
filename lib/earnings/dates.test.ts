import { describe, expect, it } from "vitest";
import { addDays, daysBetween, isValidISODate, parseISODate, toISODate } from "./dates";

describe("dates", () => {
  it("formats local dates without shifting the day", () => {
    // 00:30 on 17 Oct local time: toISOString() would give 16 Oct for UTC+5:30 users.
    expect(toISODate(new Date(2026, 9, 17, 0, 30))).toBe("2026-10-17");
    expect(toISODate(new Date(2026, 9, 17, 23, 59))).toBe("2026-10-17");
  });

  it("round-trips through parse", () => {
    expect(toISODate(parseISODate("2026-02-28"))).toBe("2026-02-28");
  });

  it("validates real calendar dates only", () => {
    expect(isValidISODate("2026-10-17")).toBe(true);
    expect(isValidISODate("2028-02-29")).toBe(true);
    expect(isValidISODate("2026-02-29")).toBe(false);
    expect(isValidISODate("2026-13-01")).toBe(false);
    expect(isValidISODate("2026-10-32")).toBe(false);
    expect(isValidISODate("17-10-2026")).toBe(false);
    expect(isValidISODate("kal")).toBe(false);
    expect(isValidISODate("")).toBe(false);
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(addDays("2026-10-17", 0)).toBe("2026-10-17");
  });

  it("counts calendar days between dates", () => {
    expect(daysBetween("2026-10-10", "2026-10-17")).toBe(7);
    expect(daysBetween("2026-10-17", "2026-10-10")).toBe(-7);
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
    expect(daysBetween("2026-10-17", "2026-10-17")).toBe(0);
  });
});
