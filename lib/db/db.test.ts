import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { _openForTest, addEntries, clearAllEarnings, deleteEntry, listEntries, sortNewestFirst, watchEntries } from "./index";
import type { EarningEntry, NewEntry } from "../earnings/math";

const e = (date: string, over: Partial<NewEntry> = {}): NewEntry => ({
  date,
  platform: "Swiggy",
  grossInr: 1000,
  deductionsInr: 0,
  fuelInr: 0,
  otherCostInr: 0,
  ...over,
});

let n = 0;
beforeEach(() => {
  // A fresh database per test, so tests cannot affect each other.
  _openForTest(`test-${++n}`);
});

describe("earnings storage", () => {
  it("adds entries, assigns ids and a creation time", async () => {
    const ids = await addEntries([e("2026-10-17"), e("2026-10-16")]);
    expect(ids).toHaveLength(2);
    const all = await listEntries();
    expect(all).toHaveLength(2);
    expect(all.every((x) => typeof x.id === "number" && x.createdAt > 0)).toBe(true);
  });

  it("lists newest date first, and the latest-added first within a day", async () => {
    await addEntries([e("2026-10-15"), e("2026-10-17", { platform: "first" }), e("2026-10-16")]);
    await addEntries([e("2026-10-17", { platform: "second" })]);
    const all = await listEntries();
    expect(all.map((x) => x.date)).toEqual(["2026-10-17", "2026-10-17", "2026-10-16", "2026-10-15"]);
    expect(all[0].platform).toBe("second");
  });

  it("stores optional fields only when present and keeps them intact", async () => {
    await addEntries([e("2026-10-17", { orders: 12, hours: 8.5, km: 60, notes: "rain" })]);
    const [row] = await listEntries();
    expect(row).toMatchObject({ orders: 12, hours: 8.5, km: 60, notes: "rain", grossInr: 1000 });
  });

  it("deletes one entry and leaves the rest", async () => {
    const [a, b] = await addEntries([e("2026-10-17"), e("2026-10-16")]);
    await deleteEntry(a);
    const all = await listEntries();
    expect(all.map((x) => x.id)).toEqual([b]);
  });

  it("deleting a missing id is harmless", async () => {
    await expect(deleteEntry(9999)).resolves.toBeUndefined();
  });

  it("clears everything", async () => {
    await addEntries([e("2026-10-17"), e("2026-10-16")]);
    await clearAllEarnings();
    expect(await listEntries()).toEqual([]);
  });

  it("adding an empty list is a no-op", async () => {
    expect(await addEntries([])).toEqual([]);
    expect(await listEntries()).toEqual([]);
  });
});

describe("watchEntries", () => {
  const nextValue = (subscribe: (cb: (r: EarningEntry[]) => void) => () => void) =>
    new Promise<EarningEntry[]>((resolve) => {
      const off = subscribe((rows) => {
        resolve(rows);
        off?.();
      });
    });

  it("emits the current rows immediately", async () => {
    await addEntries([e("2026-10-17")]);
    const rows = await nextValue((cb) => watchEntries(cb));
    expect(rows).toHaveLength(1);
  });

  it("emits again when data changes, sorted newest first", async () => {
    const seen: number[][] = [];
    let unsub = () => {};
    const done = new Promise<void>((resolve) => {
      unsub = watchEntries((rows) => {
        seen.push(rows.map((r) => r.id as number));
        if (rows.length === 2) resolve();
      });
    });
    await addEntries([e("2026-10-10")]);
    await addEntries([e("2026-10-17")]);
    await done;
    unsub();
    expect(seen.at(-1)).toHaveLength(2);
  });

  it("stops emitting after unsubscribe", async () => {
    let calls = 0;
    const off = watchEntries(() => calls++);
    await new Promise((r) => setTimeout(r, 30));
    off();
    const before = calls;
    await addEntries([e("2026-10-17")]);
    await new Promise((r) => setTimeout(r, 50));
    expect(calls).toBe(before);
  });
});

describe("sortNewestFirst", () => {
  it("does not mutate its input", () => {
    const rows = [{ id: 1, date: "2026-10-01" }, { id: 2, date: "2026-10-02" }] as EarningEntry[];
    const copy = [...rows];
    sortNewestFirst(rows);
    expect(rows).toEqual(copy);
  });
});
