// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadCsv } from "./download";
import type { EarningEntry } from "./math";

const entry = (over: Partial<EarningEntry> = {}): EarningEntry => ({
  date: "2026-10-16",
  platform: "Swiggy",
  grossInr: 1850,
  deductionsInr: 0,
  fuelInr: 400,
  otherCostInr: 0,
  createdAt: 0,
  ...over,
});

/** A browser that records the file it was asked to save, and the name it was given. */
function browser() {
  const saved: { blob: Blob; name: string; href: string }[] = [];
  const revoked: string[] = [];
  let blobSeen: Blob | null = null;
  URL.createObjectURL = vi.fn((b: Blob | MediaSource) => {
    blobSeen = b as Blob;
    return "blob:saathi-test-1";
  });
  URL.revokeObjectURL = vi.fn((u: string) => void revoked.push(u));
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    saved.push({ blob: blobSeen!, name: this.download, href: this.href });
  });
  return { saved, revoked };
}

afterEach(() => vi.restoreAllMocks());

describe("downloadCsv", () => {
  it("saves one spreadsheet file named for the day it was taken", async () => {
    const { saved } = browser();
    downloadCsv([entry()], "2026-10-17");
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe("saathi-earnings-2026-10-17.csv");
    expect(saved[0].blob.type).toBe("text/csv;charset=utf-8");
  });

  it("holds every entry, oldest first, with a header row", async () => {
    const { saved } = browser();
    downloadCsv(
      [entry({ date: "2026-10-16", platform: "Zomato" }), entry({ date: "2026-10-15", platform: "Swiggy" })],
      "2026-10-17",
    );
    const lines = (await saved[0].blob.text()).replace(/^﻿/, "").trim().split("\n");
    expect(lines[0]).toContain("date,platform,gross_inr");
    expect(lines[1]).toContain("2026-10-15,Swiggy");
    expect(lines[2]).toContain("2026-10-16,Zomato");
  });

  it("starts with a byte-order mark so Excel shows Hindi app names correctly", async () => {
    const { saved } = browser();
    downloadCsv([entry({ platform: "उबर" })], "2026-10-17");
    const bytes = new Uint8Array(await saved[0].blob.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(await saved[0].blob.text()).toContain("उबर");
  });

  it("lets go of the temporary file link afterwards so the phone's memory is freed", () => {
    const { saved, revoked } = browser();
    downloadCsv([entry()], "2026-10-17");
    expect(saved[0].href).toBe("blob:saathi-test-1");
    expect(revoked).toEqual(["blob:saathi-test-1"]);
  });
});
