"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { WorkerProfile, WorkerType } from "../eligibility/engine";

/**
 * What the worker has told Saathi about themselves, kept on this device only. It feeds the
 * eligibility checker and is sent along with chat questions so answers fit them.
 */
const KEY = "saathi.profile";
const EVENT = "saathi-profile-change";

const WORKER_TYPES: readonly WorkerType[] = [
  "delivery",
  "cab_driver",
  "construction",
  "domestic",
  "street_vendor",
  "other",
];

const isNum = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;

/**
 * Keeps only well-formed fields. Storage can be edited or corrupted, and a profile feeds
 * eligibility decisions, so nothing is trusted. Unknown keys and bad values are dropped.
 */
export function sanitizeProfile(raw: unknown): WorkerProfile {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: WorkerProfile = {};

  if (isNum(r.age, 0, 120) && Number.isInteger(r.age)) out.age = r.age;
  if (typeof r.state === "string" && r.state.trim() && r.state.length <= 60) out.state = r.state.trim();
  if (WORKER_TYPES.includes(r.workerType as WorkerType)) out.workerType = r.workerType as WorkerType;
  if (isNum(r.monthlyIncomeInr, 0, 10_000_000)) out.monthlyIncomeInr = r.monthlyIncomeInr;
  for (const flag of ["isPlatformWorker", "isIncomeTaxPayer", "inEpfoOrEsic", "hasBankAccount", "hasEshram"] as const) {
    if (typeof r[flag] === "boolean") out[flag] = r[flag];
  }
  return out;
}

function parse(text: string): WorkerProfile {
  try {
    return sanitizeProfile(JSON.parse(text));
  } catch {
    return {};
  }
}

export function saveProfile(profile: WorkerProfile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(sanitizeProfile(profile)));
  } catch {
    /* private mode: the profile still applies until the page closes via the event below */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT, callback);
  };
}

function snapshot(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

/** The saved profile. Empty on the server and on first render, then the saved one: no hydration mismatch. */
export function useProfile(): WorkerProfile {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  return useMemo(() => parse(raw), [raw]);
}
