import { describe, expect, it } from "vitest";
import { checkEligibility } from "./engine";
import { EMPTY_QUALIFY, formFromProfile, profileFromForm, type QualifyForm } from "./form";
import { INDIAN_STATES } from "./states";

const form = (over: Partial<QualifyForm> = {}): QualifyForm => ({ ...EMPTY_QUALIFY, ...over });

describe("profileFromForm", () => {
  it("turns the answers into a profile", () => {
    expect(
      profileFromForm(form({ age: "34", state: " Bihar ", workerType: "delivery", income: "14,000", platform: "yes", tax: "no", pf: "no", bank: "yes", eshram: "no" })),
    ).toEqual({
      age: 34,
      state: "Bihar",
      workerType: "delivery",
      monthlyIncomeInr: 14000,
      isPlatformWorker: true,
      isIncomeTaxPayer: false,
      inEpfoOrEsic: false,
      hasBankAccount: true,
      hasEshram: false,
    });
  });

  it("treats 'not sure' and blanks as unknown, never as 'no' (which could wrongly rule someone out)", () => {
    expect(profileFromForm(EMPTY_QUALIFY)).toEqual({});
    const p = profileFromForm(form({ tax: "unsure", pf: "unsure" }));
    expect(p).not.toHaveProperty("isIncomeTaxPayer");
    expect(p).not.toHaveProperty("inEpfoOrEsic");
  });

  it("drops an age or income that is not a sensible number", () => {
    expect(profileFromForm(form({ age: "abc", income: "lots" }))).toEqual({});
    expect(profileFromForm(form({ age: "30.5" }))).toEqual({});
    expect(profileFromForm(form({ age: "400" }))).toEqual({});
  });

  it("an 'unsure' worker is never told 'not eligible' because of it", () => {
    const { results } = checkEligibility(profileFromForm(form({ age: "30" })), ["scheme.pmsym"]);
    expect(results[0].verdict).toBe("maybe");
  });
});

describe("formFromProfile", () => {
  it("round-trips a saved profile", () => {
    const f = form({ age: "34", state: "Bihar", workerType: "cab_driver", income: "14000", platform: "yes", tax: "no", pf: "no", bank: "yes", eshram: "no" });
    expect(formFromProfile(profileFromForm(f))).toEqual(f);
  });
  it("shows an empty profile as an empty form", () => {
    expect(formFromProfile({})).toEqual(EMPTY_QUALIFY);
  });
});

describe("INDIAN_STATES", () => {
  it("has all 28 states and 8 union territories, and the states with gig laws", () => {
    expect(INDIAN_STATES).toHaveLength(36);
    for (const s of ["Rajasthan", "Karnataka", "Bihar", "Jharkhand", "Telangana"]) expect(INDIAN_STATES).toContain(s);
  });
  it("has no duplicates", () => {
    expect(new Set(INDIAN_STATES).size).toBe(INDIAN_STATES.length);
  });
});
