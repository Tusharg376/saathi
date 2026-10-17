import { toCsv, type EarningEntry } from "./math";

/** Saves the worker's entries as a spreadsheet file. Browser only. */
export function downloadCsv(entries: EarningEntry[], today: string): void {
  // The byte-order mark makes Excel read Hindi platform names as UTF-8.
  const blob = new Blob(["﻿" + toCsv(entries)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `saathi-earnings-${today}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
