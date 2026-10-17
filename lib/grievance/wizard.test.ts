import { describe, expect, it } from "vitest";
import type { DraftOutcome } from "./client";
import { sanitizeContact } from "./contact";
import { GrievanceRequest } from "./draft";
import { EMPTY_FIELDS, buildGrievanceRequest, detailsFrom } from "./request";
import { viewFromOutcome } from "./view";

describe("detailsFrom", () => {
  it("trims, parses the amount the way people type it, and leaves blanks out", () => {
    expect(detailsFrom({ party: " Swiggy ", dates: "12 Oct", amount: "1,200", ids: " T-1 " }, " Lucknow ")).toEqual({
      party: "Swiggy",
      dates: "12 Oct",
      amountInr: 1200,
      ids: "T-1",
      city: "Lucknow",
    });
    expect(detailsFrom(EMPTY_FIELDS)).toEqual({ party: undefined, dates: undefined, amountInr: undefined, ids: undefined, city: undefined });
  });
  it("ignores an amount that is not a positive number", () => {
    for (const amount of ["abc", "0", "-5", "  "]) expect(detailsFrom({ ...EMPTY_FIELDS, amount }).amountInr).toBeUndefined();
  });
  it("rounds to whole rupees", () => {
    expect(detailsFrom({ ...EMPTY_FIELDS, amount: "1200.6" }).amountInr).toBe(1201);
  });
});

describe("buildGrievanceRequest", () => {
  const base = { issue: "short_payment" as const, lang: "hi" as const, letterLang: "en" as const, description: "  They did not pay me Rs 1200.  ", fields: EMPTY_FIELDS, final: false };

  it("produces a request the server accepts", () => {
    expect(GrievanceRequest.safeParse(buildGrievanceRequest(base)).success).toBe(true);
  });
  it("trims the description and carries the final flag", () => {
    const r = buildGrievanceRequest({ ...base, final: true });
    expect(r.description).toBe("They did not pay me Rs 1200.");
    expect(r.final).toBe(true);
  });
  it("sends only the questions that were answered", () => {
    const r = buildGrievanceRequest({ ...base, final: true, questions: ["Which app?", "When?"], answers: ["Swiggy", "  "] });
    expect(r.answers).toEqual([{ q: "Which app?", a: "Swiggy" }]);
  });
  it("omits answers when none were given", () => {
    expect(buildGrievanceRequest({ ...base, questions: ["Which app?"], answers: [""] })).not.toHaveProperty("answers");
  });
  it("never includes the worker's name or phone: the builder has no way to receive them", () => {
    const json = JSON.stringify(buildGrievanceRequest({ ...base, city: "Lucknow" }));
    expect(json).not.toMatch(/name|phone/i);
  });
});

describe("viewFromOutcome", () => {
  const ctx = {
    issue: "short_payment" as const,
    description: "Swiggy did not pay me for 12 October.",
    details: { party: "Swiggy", amountInr: 1200 },
    contact: { name: "Raju Kumar", phone: "9876543210", city: "Lucknow" },
    date: "17 October 2026",
  };
  const draft = { needsInfo: false, questions: [], subject: "Complaint", letter: "Date: {{date}}\nYours,\n{{name}}\n{{phone}}", summary: "It asks Swiggy to pay.", evidence: ["Screenshot"] };

  it("fills the worker's own details into an AI letter, locally", () => {
    const v = viewFromOutcome({ kind: "letter", draft }, ctx);
    expect(v?.letter).toBe("Date: 17 October 2026\nYours,\nRaju Kumar\n9876543210");
    expect(v).toMatchObject({ subject: "Complaint", summary: "It asks Swiggy to pay.", evidence: ["Screenshot"] });
    expect(v?.notice).toBeUndefined();
  });
  it("falls back to the standard subject if the model gave none", () => {
    expect(viewFromOutcome({ kind: "letter", draft: { ...draft, subject: "" } }, ctx)?.subject).toMatch(/payment/i);
  });
  it("builds the offline template, with the worker's words and a notice saying why", () => {
    const noKey = viewFromOutcome({ kind: "template", reason: "no_key" }, ctx);
    expect(noKey?.letter).toContain("Swiggy did not pay me for 12 October.");
    expect(noKey?.letter).toContain("Raju Kumar");
    expect(noKey?.notice).toBe("cmp.no_ai");
    expect(noKey?.summary).toBe("");
    expect(viewFromOutcome({ kind: "template", reason: "failed" }, ctx)?.notice).toBe("cmp.fail_ai");
  });
  it("shows nothing for outcomes that are not a letter", () => {
    const questions: DraftOutcome = { kind: "questions", questions: ["Which app?"] };
    expect(viewFromOutcome(questions, ctx)).toBeNull();
    expect(viewFromOutcome({ kind: "rate_limited" }, ctx)).toBeNull();
  });
});

describe("sanitizeContact", () => {
  it("keeps three bounded text fields and nothing else", () => {
    expect(sanitizeContact({ name: "Raju", phone: "98", city: "Delhi", aadhaar: "2345 6789 0123" })).toEqual({ name: "Raju", phone: "98", city: "Delhi" });
  });
  it("bounds length and tolerates junk", () => {
    expect(sanitizeContact({ name: "x".repeat(500) }).name).toHaveLength(80);
    for (const junk of [null, undefined, "x", 5, [], { name: 5 }]) expect(sanitizeContact(junk)).toEqual({ name: "", phone: "", city: "" });
  });
});
