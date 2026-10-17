import { parseAmount } from "../earnings/format";
import { sanitizeProfile } from "../profile/store";
import type { WorkerProfile, WorkerType } from "./engine";

/** A yes/no question the worker may not be able to answer. "unsure" leaves the fact unknown, never "no". */
export type Tri = "yes" | "no" | "unsure";

export interface QualifyForm {
  age: string;
  state: string;
  workerType: WorkerType | "";
  income: string;
  platform: Tri;
  tax: Tri;
  pf: Tri;
  bank: Tri;
  eshram: Tri;
}

export const EMPTY_QUALIFY: QualifyForm = {
  age: "",
  state: "",
  workerType: "",
  income: "",
  platform: "unsure",
  tax: "unsure",
  pf: "unsure",
  bank: "unsure",
  eshram: "unsure",
};

const fromTri = (v: Tri): boolean | undefined => (v === "yes" ? true : v === "no" ? false : undefined);
const toTri = (v: boolean | undefined): Tri => (v === true ? "yes" : v === false ? "no" : "unsure");

/** The answers as a profile. Anything blank, unsure or invalid is simply not known. */
export function profileFromForm(f: QualifyForm): WorkerProfile {
  const age = f.age.trim() ? parseAmount(f.age) : null;
  const income = f.income.trim() ? parseAmount(f.income) : null;
  return sanitizeProfile({
    age: age !== null && Number.isInteger(age) ? age : undefined,
    state: f.state.trim() || undefined,
    workerType: f.workerType || undefined,
    monthlyIncomeInr: income ?? undefined,
    isPlatformWorker: fromTri(f.platform),
    isIncomeTaxPayer: fromTri(f.tax),
    inEpfoOrEsic: fromTri(f.pf),
    hasBankAccount: fromTri(f.bank),
    hasEshram: fromTri(f.eshram),
  });
}

/** The form showing a saved profile, so the worker can see and change what they said before. */
export function formFromProfile(p: WorkerProfile): QualifyForm {
  return {
    age: p.age === undefined ? "" : String(p.age),
    state: p.state ?? "",
    workerType: p.workerType ?? "",
    income: p.monthlyIncomeInr === undefined ? "" : String(p.monthlyIncomeInr),
    platform: toTri(p.isPlatformWorker),
    tax: toTri(p.isIncomeTaxPayer),
    pf: toTri(p.inEpfoOrEsic),
    bank: toTri(p.hasBankAccount),
    eshram: toTri(p.hasEshram),
  };
}
