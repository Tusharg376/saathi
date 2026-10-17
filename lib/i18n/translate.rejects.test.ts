import { describe, expect, it } from "vitest";
import { getEntry } from "../kb";
import { acceptKbTranslation } from "./translate-utils";

const pmsym = getEntry("scheme.pmsym")!;
const reasonFor = (candidate: unknown) =>
  acceptKbTranslation(pmsym, candidate).rejected.map((r) => `${r.key}: ${r.reason}`);

describe("acceptKbTranslation: machine translations that must NOT reach a worker", () => {
  it("drops a blank title or summary, so English shows instead of an empty heading", () => {
    const r = acceptKbTranslation(pmsym, { title: "   ", summary: "" });
    expect(r.accepted).toEqual({});
    expect(r.rejected.map((x) => x.reason)).toEqual(["empty", "empty"]);
  });

  it("drops a summary where a figure was changed, such as the age or amount of a scheme", () => {
    const wrong = pmsym.summary.replace(/\d+/, "99");
    expect(reasonFor({ summary: wrong })).toEqual(["scheme.pmsym.summary: a number was changed or lost"]);
  });

  it("drops a summary that ran away into a long ramble", () => {
    expect(reasonFor({ summary: pmsym.summary + " ".repeat(5) + "x".repeat(pmsym.summary.length * 4 + 100) })).toEqual([
      "scheme.pmsym.summary: suspiciously long",
    ]);
  });

  it("drops a whole list if any one line in it is blank, so lines never shift under the wrong English", () => {
    const lines = [...pmsym.eligibility!];
    lines[1] = "  ";
    expect(reasonFor({ eligibility: lines })).toEqual(["scheme.pmsym.eligibility: an item is empty"]);
  });

  it("drops a whole list if any one line ran away", () => {
    const lines = [...pmsym.eligibility!];
    lines[0] = lines[0] + " " + "y".repeat(lines[0].length * 4 + 100);
    expect(reasonFor({ eligibility: lines })).toEqual(["scheme.pmsym.eligibility: suspiciously long"]);
  });

  it("keeps the good fields of the same translation while rejecting the bad ones", () => {
    const lines = [...pmsym.eligibility!];
    lines[1] = "";
    const r = acceptKbTranslation(pmsym, { title: "एक अच्छा शीर्षक", eligibility: lines });
    expect(r.accepted.title).toBe("एक अच्छा शीर्षक");
    expect(r.accepted.eligibility).toBeUndefined();
    expect(r.rejected).toHaveLength(1);
  });
});
