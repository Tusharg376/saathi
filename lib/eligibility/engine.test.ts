import { describe, expect, it } from "vitest";
import { checkEligibility, type WorkerProfile } from "./engine";

const verdictOf = (profile: WorkerProfile, id: string) =>
  checkEligibility(profile, [id]).results.find((r) => r.schemeId === id)?.verdict;

const young: WorkerProfile = {
  age: 25,
  monthlyIncomeInr: 12000,
  isIncomeTaxPayer: false,
  inEpfoOrEsic: false,
  hasBankAccount: true,
};

describe("eligibility engine", () => {
  it("clear match is likely", () => {
    expect(verdictOf(young, "scheme.eshram")).toBe("likely");
    expect(verdictOf(young, "scheme.pmsym")).toBe("likely");
    expect(verdictOf(young, "scheme.pmsby")).toBe("likely");
    expect(verdictOf(young, "scheme.pmjjby")).toBe("likely");
  });

  it("age limits are enforced at the boundaries", () => {
    expect(verdictOf({ ...young, age: 40 }, "scheme.pmsym")).toBe("likely");
    expect(verdictOf({ ...young, age: 41 }, "scheme.pmsym")).toBe("not_eligible");
    expect(verdictOf({ ...young, age: 17 }, "scheme.pmsym")).toBe("not_eligible");
    expect(verdictOf({ ...young, age: 59 }, "scheme.eshram")).toBe("likely");
    expect(verdictOf({ ...young, age: 60 }, "scheme.eshram")).toBe("not_eligible");
    expect(verdictOf({ ...young, age: 50 }, "scheme.pmjjby")).toBe("likely");
    expect(verdictOf({ ...young, age: 51 }, "scheme.pmjjby")).toBe("not_eligible");
    expect(verdictOf({ ...young, age: 70 }, "scheme.pmsby")).toBe("likely");
    expect(verdictOf({ ...young, age: 71 }, "scheme.pmsby")).toBe("not_eligible");
  });

  it("income, tax and EPFO disqualify", () => {
    expect(verdictOf({ ...young, monthlyIncomeInr: 15000 }, "scheme.pmsym")).toBe("likely");
    expect(verdictOf({ ...young, monthlyIncomeInr: 15001 }, "scheme.pmsym")).toBe("not_eligible");
    expect(verdictOf({ ...young, isIncomeTaxPayer: true }, "scheme.eshram")).toBe("not_eligible");
    expect(verdictOf({ ...young, inEpfoOrEsic: true }, "scheme.eshram")).toBe("not_eligible");
  });

  it("unknown facts give 'maybe' and say what is missing, never a false 'not eligible'", () => {
    const r = checkEligibility({ age: 30 }, ["scheme.pmsym"]).results[0];
    expect(r.verdict).toBe("maybe");
    expect(r.missing).toContain("roughly how much you earn in a month");
    expect(r.failed).toEqual([]);
  });

  it("a definite failure wins over unknowns", () => {
    expect(verdictOf({ age: 55 }, "scheme.pmsym")).toBe("not_eligible");
  });

  it("no bank account blocks the insurance schemes", () => {
    expect(verdictOf({ ...young, hasBankAccount: false }, "scheme.pmsby")).toBe("not_eligible");
  });

  it("announced benefits are capped at 'maybe' even when every criterion passes", () => {
    const p: WorkerProfile = { isPlatformWorker: true, hasEshram: true };
    expect(verdictOf(p, "scheme.pmjay_gig")).toBe("maybe");
    const r = checkEligibility(p, ["scheme.pmjay_gig"]).results[0];
    expect(r.status).toBe("announced");
    expect(r.status_note).toBeTruthy();
  });

  it("gig-worker cover requires being a platform worker with e-Shram", () => {
    expect(verdictOf({ isPlatformWorker: true, hasEshram: false }, "scheme.pmjay_gig")).toBe("not_eligible");
    expect(verdictOf({ isPlatformWorker: false, hasEshram: true }, "scheme.pmjay_gig")).toBe("not_eligible");
  });

  it("PM-JAY always needs a list check, never a flat yes", () => {
    const r = checkEligibility(young, ["scheme.pmjay"]).results[0];
    expect(r.verdict).toBe("maybe");
    expect(r.missing.join(" ")).toMatch(/eligibility list/i);
  });

  it("worker type gates SVANidhi and BOCW", () => {
    expect(verdictOf({ workerType: "street_vendor" }, "scheme.pmsvanidhi")).toBe("likely");
    expect(verdictOf({ workerType: "delivery" }, "scheme.pmsvanidhi")).toBe("not_eligible");
    expect(verdictOf({ workerType: "construction", age: 35 }, "scheme.bocw")).toBe("likely");
    expect(verdictOf({ workerType: "construction", age: 61 }, "scheme.bocw")).toBe("not_eligible");
  });

  it("screens only the worker's own state gig law", () => {
    const { results } = checkEligibility({ isPlatformWorker: true, state: "Karnataka" });
    const stateActs = results.filter((r) => r.schemeId.startsWith("right.gig_act_"));
    expect(stateActs.map((r) => r.schemeId)).toEqual(["right.gig_act_karnataka"]);
    expect(stateActs[0].verdict).toBe("likely");
    expect(stateActs[0].status).toBe("state_specific");
  });

  it("asks for the state when unknown instead of listing every state", () => {
    const { results, hints } = checkEligibility({ isPlatformWorker: true });
    expect(results.some((r) => r.schemeId.startsWith("right.gig_act_"))).toBe(false);
    expect(hints.join(" ")).toMatch(/your state/);
  });

  it("matching is case-insensitive for state", () => {
    const { results } = checkEligibility({ isPlatformWorker: true, state: "bihar" });
    expect(results.some((r) => r.schemeId === "right.gig_act_bihar")).toBe(true);
  });

  it("sorts likely before maybe before not_eligible", () => {
    const { results } = checkEligibility({ ...young, age: 45 });
    const order = { likely: 0, maybe: 1, not_eligible: 2 } as const;
    const ranks = results.map((r) => order[r.verdict]);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it("hints list only things the worker can answer", () => {
    const { hints } = checkEligibility({});
    expect(hints.length).toBeGreaterThan(0);
    for (const h of hints) expect(h).toMatch(/^Tell me /);
  });

  it("an empty profile never crashes and never says likely", () => {
    const { results } = checkEligibility({});
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.verdict === "likely")).toBe(false);
  });
});

describe("needs: gaps as profile fields", () => {
  it("names the profile fields still unknown, so a screen can ask for them in the worker's language", () => {
    const r = checkEligibility({ age: 30 }, ["scheme.pmsym"]).results[0];
    expect(r.needs.sort()).toEqual(["inEpfoOrEsic", "isIncomeTaxPayer", "monthlyIncomeInr"]);
  });
  it("is empty once everything the rules need is known", () => {
    expect(checkEligibility(young, ["scheme.pmsym"]).results[0].needs).toEqual([]);
  });
  it("does not list a field for a rule that is not about the worker's answers (the PM-JAY list check)", () => {
    expect(checkEligibility(young, ["scheme.pmjay"]).results[0].needs).toEqual([]);
  });
});
