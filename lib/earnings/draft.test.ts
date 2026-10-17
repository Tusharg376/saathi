import { describe, expect, it } from "vitest";
import { draftFromEntry, emptyDraft, validateDraft, validateDrafts, type Draft } from "./draft";

const TODAY = "2026-10-17";
const draft = (over: Partial<Draft> = {}): Draft => ({ ...emptyDraft(TODAY), platform: "Swiggy", gross: "1850", ...over });

describe("validateDraft", () => {
  it("turns a typed form into a clean entry; blank means zero", () => {
    const r = validateDraft(draft({ fuel: "400", orders: "12" }), TODAY);
    expect(r).toEqual({
      ok: true,
      entry: { date: TODAY, platform: "Swiggy", grossInr: 1850, deductionsInr: 0, fuelInr: 400, otherCostInr: 0, orders: 12 },
    });
  });

  it("reads amounts the way people type them", () => {
    const r = validateDraft(draft({ gross: "₹1,850", fuel: "Rs. 400", other: " 1 20 " }), TODAY);
    expect(r.ok && r.entry).toMatchObject({ grossInr: 1850, fuelInr: 400, otherCostInr: 120 });
  });

  it("flags typed text that is not a number instead of treating it as zero", () => {
    const r = validateDraft(draft({ fuel: "12abc" }), TODAY);
    expect(r).toEqual({ ok: false, errors: { fuel: "number" } });
  });

  it("requires at least one amount", () => {
    const r = validateDraft(draft({ gross: "" }), TODAY);
    expect(r).toEqual({ ok: false, errors: { amounts: "none" } });
    expect(validateDraft(draft({ gross: "0" }), TODAY).ok).toBe(false);
  });

  it("accepts a cost-only entry (a loss day or a repair)", () => {
    const r = validateDraft(draft({ gross: "", fuel: "300" }), TODAY);
    expect(r.ok).toBe(true);
  });

  it("rejects future and invalid dates", () => {
    expect(validateDraft(draft({ date: "2026-10-18" }), TODAY)).toEqual({ ok: false, errors: { date: "future" } });
    expect(validateDraft(draft({ date: "2026-02-30" }), TODAY)).toEqual({ ok: false, errors: { date: "date" } });
    expect(validateDraft(draft({ date: "" }), TODAY)).toEqual({ ok: false, errors: { date: "date" } });
    expect(validateDraft(draft({ date: TODAY }), TODAY).ok).toBe(true);
  });

  it("enforces sane ranges", () => {
    expect(validateDraft(draft({ gross: "200001" }), TODAY)).toMatchObject({ ok: false, errors: { gross: "range" } });
    expect(validateDraft(draft({ hours: "25" }), TODAY)).toMatchObject({ ok: false, errors: { hours: "range" } });
    expect(validateDraft(draft({ orders: "501" }), TODAY)).toMatchObject({ ok: false, errors: { orders: "range" } });
    expect(validateDraft(draft({ orders: "2.5" }), TODAY)).toMatchObject({ ok: false, errors: { orders: "range" } });
    expect(validateDraft(draft({ hours: "24" }), TODAY).ok).toBe(true);
  });

  it("reports every problem at once, so the worker fixes them in one go", () => {
    const r = validateDraft(draft({ date: "2030-01-01", gross: "abc", hours: "99" }), TODAY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["date", "gross", "hours"]);
  });

  it("defaults and bounds the platform name", () => {
    expect((validateDraft(draft({ platform: "   " }), TODAY) as { entry: { platform: string } }).entry.platform).toBe("Other");
    expect((validateDraft(draft({ platform: "x".repeat(99) }), TODAY) as { entry: { platform: string } }).entry.platform).toHaveLength(40);
  });

  it("keeps decimals in hours only to one place", () => {
    const r = validateDraft(draft({ hours: "8.26" }), TODAY);
    expect(r.ok && r.entry.hours).toBe(8.3);
  });

  it("omits optional fields that are blank or zero", () => {
    const r = validateDraft(draft({ orders: "0", hours: "", km: " " }), TODAY);
    expect(r.ok && r.entry).not.toHaveProperty("orders");
    expect(r.ok && r.entry).not.toHaveProperty("hours");
    expect(r.ok && r.entry).not.toHaveProperty("km");
  });
});

describe("draft round trip", () => {
  it("an entry survives entry -> draft -> entry", () => {
    const entry = { date: TODAY, platform: "Zomato", grossInr: 900, deductionsInr: 50, fuelInr: 200, otherCostInr: 0, orders: 7, hours: 6.5, km: 40 };
    const r = validateDraft(draftFromEntry(entry), TODAY);
    expect(r).toEqual({ ok: true, entry });
  });

  it("renders zeros as blanks so the form is not cluttered", () => {
    const d = draftFromEntry({ date: TODAY, platform: "X", grossInr: 100, deductionsInr: 0, fuelInr: 0, otherCostInr: 0 });
    expect(d).toMatchObject({ cuts: "", fuel: "", other: "", orders: "", hours: "", km: "" });
  });

  it("starts empty on the given day", () => {
    expect(emptyDraft(TODAY)).toMatchObject({ date: TODAY, platform: "", gross: "" });
  });
});

describe("validateDrafts", () => {
  it("returns every entry when all forms are valid", () => {
    const r = validateDrafts([draft(), draft({ platform: "Zomato", gross: "900" })], TODAY);
    expect(r.ok && r.entries.map((e) => e.platform)).toEqual(["Swiggy", "Zomato"]);
  });

  it("reports the errors of each invalid form at the right position, so each form can show its own", () => {
    const r = validateDrafts([draft(), draft({ gross: "abc" }), draft({ date: "2030-01-01" })], TODAY);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toHaveLength(3);
      expect(r.errors[0]).toEqual({});
      expect(r.errors[1]).toEqual({ gross: "number" });
      expect(r.errors[2]).toEqual({ date: "future" });
    }
  });

  it("saves nothing if any one form is invalid", () => {
    expect(validateDrafts([draft(), draft({ gross: "" })], TODAY).ok).toBe(false);
  });

  it("handles an empty list", () => {
    expect(validateDrafts([], TODAY)).toEqual({ ok: true, entries: [] });
  });
});
