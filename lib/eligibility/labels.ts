import type { MessageKey } from "../i18n/messages";
import type { WorkerProfile, WorkerType } from "./engine";

/** What to call each profile fact on screen. A Record, so a new profile field cannot ship without a label. */
export const FIELD_LABEL: Record<keyof WorkerProfile, MessageKey> = {
  age: "qual.age",
  state: "qual.state",
  workerType: "qual.work",
  isPlatformWorker: "qual.platform",
  monthlyIncomeInr: "qual.income",
  isIncomeTaxPayer: "qual.tax",
  inEpfoOrEsic: "qual.pf",
  hasBankAccount: "qual.bank",
  hasEshram: "qual.eshram",
};

export const WORK_LABEL: Record<WorkerType, MessageKey> = {
  delivery: "qual.work.delivery",
  cab_driver: "qual.work.cab_driver",
  construction: "qual.work.construction",
  domestic: "qual.work.domestic",
  street_vendor: "qual.work.street_vendor",
  other: "qual.work.other",
};
