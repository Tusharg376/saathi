import { z } from "zod";
import schemesJson from "./data/schemes.json";
import rightsJson from "./data/rights.json";
import safetyJson from "./data/safety.json";
import grievanceJson from "./data/grievance.json";
import helplinesJson from "./data/helplines.json";
import { Helpline, KbEntry } from "./types";

export { Helpline, KbEntry } from "./types";
export type { KbCategory, KbStatus } from "./types";

/**
 * Parsed once at import. Bad data fails loudly here (and in tests) instead of
 * silently feeding the model a malformed entry.
 */
const entries: KbEntry[] = z.array(KbEntry).parse([...schemesJson, ...rightsJson, ...safetyJson, ...grievanceJson]);
const helplines: Helpline[] = z.array(Helpline).parse(helplinesJson);

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

/** True only after a human or scripts/verify-kb.ts confirmed the entry against the official source. */
export function isVerified(entry: KbEntry): boolean {
  return entry.last_verified !== null;
}
