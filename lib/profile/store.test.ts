import { describe, expect, it } from "vitest";
import { sanitizeProfile } from "./store";

describe("sanitizeProfile", () => {
  it("keeps a well-formed profile exactly", () => {
    const p = {
      age: 34,
      state: "Karnataka",
      workerType: "delivery",
      monthlyIncomeInr: 14000,
      isPlatformWorker: true,
      isIncomeTaxPayer: false,
      inEpfoOrEsic: false,
      hasBankAccount: true,
      hasEshram: false,
    };
    expect(sanitizeProfile(p)).toEqual(p);
  });

  it("drops anything out of range or the wrong type, instead of letting it into eligibility decisions", () => {
    expect(
      sanitizeProfile({ age: 400, state: "", workerType: "astronaut", monthlyIncomeInr: -5, hasEshram: "yes", isPlatformWorker: 1 }),
    ).toEqual({});
    expect(sanitizeProfile({ age: 30.5 })).toEqual({});
    expect(sanitizeProfile({ age: Number.NaN, monthlyIncomeInr: Number.POSITIVE_INFINITY })).toEqual({});
    expect(sanitizeProfile({ state: "x".repeat(61) })).toEqual({});
  });

  it("keeps the good fields next to bad ones", () => {
    expect(sanitizeProfile({ age: 30, workerType: "nope", hasBankAccount: true })).toEqual({ age: 30, hasBankAccount: true });
  });

  it("ignores unknown keys, so nothing unexpected is ever sent to the server", () => {
    expect(sanitizeProfile({ age: 30, aadhaar: "2345 6789 0123", isAdmin: true })).toEqual({ age: 30 });
  });

  it("trims the state and tolerates junk input", () => {
    expect(sanitizeProfile({ state: "  Bihar " })).toEqual({ state: "Bihar" });
    for (const junk of [null, undefined, "text", 42, [], true]) expect(sanitizeProfile(junk)).toEqual({});
  });

  it("accepts the boundary values", () => {
    expect(sanitizeProfile({ age: 0 })).toEqual({ age: 0 });
    expect(sanitizeProfile({ age: 120, monthlyIncomeInr: 0 })).toEqual({ age: 120, monthlyIncomeInr: 0 });
  });
});
