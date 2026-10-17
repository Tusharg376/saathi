import schemesJson from "./data/schemes.json";
import rightsJson from "./data/rights.json";
import safetyJson from "./data/safety.json";
import grievanceJson from "./data/grievance.json";
import helplinesJson from "./data/helplines.json";
import type { Helpline, KbEntry } from "./types";

export type { Helpline, KbCategory, KbEntry, KbStatus } from "./types";

/**
 * The data is checked against the schema by the test suite (lib/kb/kb.test.ts), not when the app
 * starts: the screens would otherwise carry the whole validation library just to re-check
 * a file that only changes in a commit.
 */
const entries = [...schemesJson, ...rightsJson, ...safetyJson, ...grievanceJson] as unknown as KbEntry[];
const helplines = helplinesJson as unknown as Helpline[];

const byId = new Map(entries.map((e) => [e.id, e]));

export function allEntries(): readonly KbEntry[] {
  return entries;
}

export function getEntry(id: string): KbEntry | undefined {
  return byId.get(id);
}

export function allHelplines(): readonly Helpline[] {
  return helplines;
}

export function getHelpline(id: string): Helpline | undefined {
  return helplines.find((h) => h.id === id);
}

/** True only after a person confirmed the entry against the official source and set its date. */
export function isVerified(entry: KbEntry): boolean {
  return entry.last_verified !== null;
}
