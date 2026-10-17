import { getEntry, type KbStatus } from "../kb";

/**
 * Deterministic eligibility screening. The LLM explains the result; it never
 * decides it. Every rule is data, so it can be audited against the official
 * scheme rules and unit-tested.
 */

export type WorkerType = "delivery" | "cab_driver" | "construction" | "domestic" | "street_vendor" | "other";

export interface WorkerProfile {
  age?: number;
  state?: string;
  workerType?: WorkerType;
  /** Works through an app or platform (Swiggy, Zomato, Uber, Ola, Rapido, Urban Company...) */
  isPlatformWorker?: boolean;
  monthlyIncomeInr?: number;
  isIncomeTaxPayer?: boolean;
  inEpfoOrEsic?: boolean;
  hasBankAccount?: boolean;
  hasEshram?: boolean;
}

export type Verdict = "likely" | "maybe" | "not_eligible";

export interface EligibilityResult {
  schemeId: string;
  title: string;
  verdict: Verdict;
  /** Criteria the profile satisfies. */
  passed: string[];
  /** Criteria the profile fails (why not eligible). */
  failed: string[];
  /** What we still need to know to be sure, as sentences. */
  missing: string[];
  /** The same gaps as profile fields, so a screen can ask for them in the worker's own language. */
  needs: (keyof WorkerProfile)[];
  status: KbStatus;
  status_note?: string;
}

export interface EligibilityReport {
  results: EligibilityResult[];
  /** Things worth asking the worker so the screening gets sharper. */
  hints: string[];
}

interface Criterion {
  label: string;
  /** Profile field this depends on, used to tell the worker what is missing. */
  needs?: keyof WorkerProfile;
  /** true = pass, false = fail, undefined = unknown. */
  test: (p: WorkerProfile) => boolean | undefined;
}

const between =
  (min: number, max: number): Criterion["test"] =>
  (p) =>
    p.age === undefined ? undefined : p.age >= min && p.age <= max;

const FIELD_QUESTIONS: Record<keyof WorkerProfile, string> = {
  age: "your age",
  state: "your state",
  workerType: "what kind of work you do",
  isPlatformWorker: "whether you work through an app or platform",
  monthlyIncomeInr: "roughly how much you earn in a month",
  isIncomeTaxPayer: "whether you pay income tax",
  inEpfoOrEsic: "whether you are a member of EPFO (PF) or ESIC",
  hasBankAccount: "whether you have a bank account",
  hasEshram: "whether you are registered on e-Shram",
};

const QUESTION_TEXTS = new Set<string>(Object.values(FIELD_QUESTIONS));

const notTaxpayer: Criterion = {
  label: "Not an income tax payer",
  needs: "isIncomeTaxPayer",
  test: (p) => (p.isIncomeTaxPayer === undefined ? undefined : !p.isIncomeTaxPayer),
};
const notEpfoEsic: Criterion = {
  label: "Not a member of EPFO or ESIC",
  needs: "inEpfoOrEsic",
  test: (p) => (p.inEpfoOrEsic === undefined ? undefined : !p.inEpfoOrEsic),
};
const hasBank: Criterion = {
  label: "Has a bank account",
  needs: "hasBankAccount",
  test: (p) => p.hasBankAccount,
};

export const RULES: Record<string, Criterion[]> = {
  "scheme.eshram": [{ label: "Age 16 to 59", needs: "age", test: between(16, 59) }, notTaxpayer, notEpfoEsic],
  "scheme.pmsym": [
    { label: "Age 18 to 40", needs: "age", test: between(18, 40) },
    {
      label: "Monthly income Rs 15,000 or less",
      needs: "monthlyIncomeInr",
      test: (p) => (p.monthlyIncomeInr === undefined ? undefined : p.monthlyIncomeInr <= 15000),
    },
    notTaxpayer,
    notEpfoEsic,
  ],
  "scheme.pmsby": [{ label: "Age 18 to 70", needs: "age", test: between(18, 70) }, hasBank],
  "scheme.pmjjby": [{ label: "Age 18 to 50", needs: "age", test: between(18, 50) }, hasBank],
  "scheme.pmjay": [
    {
      label: "Household is on the PM-JAY eligibility list (checked at a CSC, hospital Ayushman Mitra, or on 14555)",
      test: () => undefined,
    },
  ],
  "scheme.pmjay_gig": [
    { label: "Works through an app or platform", needs: "isPlatformWorker", test: (p) => p.isPlatformWorker },
    { label: "Registered on e-Shram", needs: "hasEshram", test: (p) => p.hasEshram },
  ],
  "scheme.pmsvanidhi": [
    {
      label: "Works as a street vendor",
      needs: "workerType",
      test: (p) => (p.workerType === undefined ? undefined : p.workerType === "street_vendor"),
    },
  ],
  "scheme.bocw": [
    {
      label: "Works in construction",
      needs: "workerType",
      test: (p) => (p.workerType === undefined ? undefined : p.workerType === "construction"),
    },
    { label: "Age 18 to 60", needs: "age", test: between(18, 60) },
  ],
};

function evaluate(schemeId: string, criteria: Criterion[], profile: WorkerProfile): EligibilityResult | null {
  const entry = getEntry(schemeId);
  if (!entry) return null;

  const passed: string[] = [];
  const failed: string[] = [];
  const missing: string[] = [];
  const needs = new Set<keyof WorkerProfile>();

  for (const c of criteria) {
    const r = c.test(profile);
    if (r === true) passed.push(c.label);
    else if (r === false) failed.push(c.label);
    else {
      missing.push(c.needs ? FIELD_QUESTIONS[c.needs] : c.label);
      if (c.needs) needs.add(c.needs);
    }
  }

  let verdict: Verdict = failed.length > 0 ? "not_eligible" : missing.length > 0 ? "maybe" : "likely";
  // Never promise a benefit that is not confirmed to be running: announced, still rolling out, or a state
  // law whose board may not be working yet. The worker's details can match; whether they can use it is not settled.
  if (entry.status !== "live" && verdict === "likely") verdict = "maybe";

  return {
    schemeId,
    title: entry.title,
    verdict,
    passed,
    failed,
    missing,
    needs: [...needs],
    status: entry.status,
    status_note: entry.status_note,
  };
}

const STATE_ACT_IDS = [
  "right.gig_act_rajasthan",
  "right.gig_act_karnataka",
  "right.gig_act_bihar",
  "right.gig_act_jharkhand",
  "right.gig_act_telangana",
];

const VERDICT_ORDER: Record<Verdict, number> = { likely: 0, maybe: 1, not_eligible: 2 };

const sameState = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** A state's gig-worker law applies to platform workers who work in that state. */
function stateActCriteria(actState: string): Criterion[] {
  return [
    { label: "Works through an app or platform", needs: "isPlatformWorker", test: (p) => p.isPlatformWorker },
    {
      label: `Works in ${actState}`,
      needs: "state",
      test: (p) => (p.state === undefined ? undefined : sameState(p.state, actState)),
    },
  ];
}

const ASK_STATE = "Tell me your state so I can check your state's gig-worker law.";

/**
 * What to do with one scheme id: the rules to screen it against, or nothing (with a hint if asking
 * the worker a question would help). A state law is only screened when the worker's state matches,
 * or when it was asked for by name; with the state unknown, we ask instead of listing every state.
 */
function planFor(id: string, profile: WorkerProfile, asked: boolean): { criteria?: Criterion[]; hint?: string } {
  if (RULES[id]) return { criteria: RULES[id] };
  if (!STATE_ACT_IDS.includes(id)) return {};

  const actState = getEntry(id)?.states?.[0];
  if (!actState) return {};
  if (!profile.state) return asked ? { criteria: stateActCriteria(actState) } : { hint: ASK_STATE };
  return sameState(profile.state, actState) ? { criteria: stateActCriteria(actState) } : {};
}

export function checkEligibility(profile: WorkerProfile, schemeIds?: string[]): EligibilityReport {
  const hints = new Set<string>();
  const results: EligibilityResult[] = [];
  const asked = Boolean(schemeIds?.length);
  const ids = asked ? (schemeIds as string[]) : [...Object.keys(RULES), ...STATE_ACT_IDS];

  for (const id of ids) {
    const plan = planFor(id, profile, asked);
    if (plan.hint) hints.add(plan.hint);
    if (!plan.criteria) continue;
    const result = evaluate(id, plan.criteria, profile);
    if (result) results.push(result);
  }

  results.sort((a, b) => VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict]);

  // Only field questions become hints. Free-text "missing" labels (e.g. the PM-JAY list check) do not.
  for (const r of results) for (const m of r.missing) if (QUESTION_TEXTS.has(m)) hints.add(`Tell me ${m}.`);

  return { results, hints: [...hints] };
}
