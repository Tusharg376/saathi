import Dexie, { liveQuery, type EntityTable } from "dexie";
import type { EarningEntry, NewEntry } from "../earnings/math";

/**
 * On-device storage. Earnings never leave the worker's phone: no accounts, no sync,
 * and the server is stateless. Everything here runs in the browser only.
 */
class SaathiDB extends Dexie {
  earnings!: EntityTable<EarningEntry, "id">;

  constructor(name = "saathi") {
    super(name);
    this.version(1).stores({
      // ++id auto-increments; date and platform are indexed for range and group queries.
      earnings: "++id, date, platform",
    });
  }
}

let db: SaathiDB | null = null;

export function getDb(): SaathiDB {
  if (typeof indexedDB === "undefined") throw new Error("On-device storage is not available in this browser.");
  return (db ??= new SaathiDB());
}

/** Test seam: use an isolated database name. */
export function _openForTest(name: string): SaathiDB {
  db = new SaathiDB(name);
  return db;
}

export async function addEntries(entries: NewEntry[]): Promise<number[]> {
  const now = Date.now();
  const rows: Omit<EarningEntry, "id">[] = entries.map((e) => ({ ...e, createdAt: now }));
  return (await getDb().earnings.bulkAdd(rows as EarningEntry[], { allKeys: true })) as number[];
}

export async function deleteEntry(id: number): Promise<void> {
  await getDb().earnings.delete(id);
}

export async function clearAllEarnings(): Promise<void> {
  await getDb().earnings.clear();
}

/** Newest first. Ties on date keep the most recently added entry on top. */
export async function listEntries(): Promise<EarningEntry[]> {
  const all = await getDb().earnings.toArray();
  return sortNewestFirst(all);
}

export function sortNewestFirst(entries: EarningEntry[]): EarningEntry[] {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0));
}

/** Calls `onChange` now and on every change. Returns an unsubscribe function. */
export function watchEntries(onChange: (entries: EarningEntry[]) => void, onError?: (e: unknown) => void): () => void {
  const sub = liveQuery(() => getDb().earnings.toArray()).subscribe({
    next: (rows) => onChange(sortNewestFirst(rows)),
    error: (e) => onError?.(e),
  });
  return () => sub.unsubscribe();
}
