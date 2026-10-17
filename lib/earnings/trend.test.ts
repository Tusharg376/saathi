import { describe, expect, it } from "vitest";
import { describeTrend } from "./trend";

describe("describeTrend (this week against last week)", () => {
  it("says nothing is known when there was no earlier week to compare with", () => {
    expect(describeTrend(null)).toEqual({ kind: "unknown" });
  });

  it("reads a rise as up, with a whole-number percentage", () => {
    expect(describeTrend(12.4)).toEqual({ kind: "up", pct: 12 });
    expect(describeTrend(12.6)).toEqual({ kind: "up", pct: 13 });
  });

  it("reads a fall as down, shown as a positive percentage the screen can word as 'down'", () => {
    expect(describeTrend(-33.4)).toEqual({ kind: "down", pct: 33 });
  });

  it("calls a change of under one percent about the same, instead of a misleading +0%", () => {
    expect(describeTrend(0)).toEqual({ kind: "same" });
    expect(describeTrend(0.99)).toEqual({ kind: "same" });
    expect(describeTrend(-0.99)).toEqual({ kind: "same" });
  });

  it("treats exactly one percent as a real change in either direction", () => {
    expect(describeTrend(1)).toEqual({ kind: "up", pct: 1 });
    expect(describeTrend(-1)).toEqual({ kind: "down", pct: 1 });
  });
});
