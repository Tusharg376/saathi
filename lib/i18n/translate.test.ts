import { describe, expect, it } from "vitest";
import { getEntry } from "../kb";
import { coverage, localizeEntry } from "../kb/localize";
import {
  acceptKbTranslation,
  acceptUiTranslations,
  batches,
  numbersOf,
  numbersPreserved,
  placeholdersOf,
  translatableFields,
} from "./translate-utils";

const pmsym = getEntry("scheme.pmsym")!;
const eshram = getEntry("scheme.eshram")!;

describe("number checks", () => {
  it("finds the numbers a translation must keep", () => {
    expect(numbersOf("Age 18 to 40, Rs 3,000 a month, call 14434")).toEqual(["18", "40", "3,000", "14434"]);
    expect(numbersOf("Rs 1,50,000.")).toEqual(["1,50,000"]);
    expect(numbersOf("no digits here")).toEqual([]);
  });

  it("requires every number to appear exactly as written", () => {
    expect(numbersPreserved("Age 18 to 40", "उम्र 18 से 40 साल")).toBe(true);
    expect(numbersPreserved("Age 18 to 40", "उम्र 18 से 45 साल")).toBe(false);
    expect(numbersPreserved("call 14434", "कॉल करें १४४३४")).toBe(false); // Devanagari digits: not dialable at a glance
    expect(numbersPreserved("Rs 3,000", "₹3000")).toBe(false); // grouping changed
  });
});

describe("acceptUiTranslations", () => {
  const source = { a: "Hello", b: "{pct}% more", c: "Call 112", d: "{n} of {m}" };

  it("accepts good translations", () => {
    const r = acceptUiTranslations(source, { a: "नमस्ते", b: "{pct}% ज़्यादा", c: "112 पर कॉल करें", d: "{m} में से {n}" });
    expect(Object.keys(r.accepted)).toEqual(["a", "b", "c", "d"]);
    expect(r.rejected).toEqual([]);
  });

  it("rejects a renamed or dropped placeholder, which would print raw to a worker", () => {
    const r = acceptUiTranslations(source, { a: "x", b: "{percent}% ज़्यादा", c: "112", d: "बस इतना" });
    expect(r.rejected.map((x) => x.key).sort()).toEqual(["b", "d"]);
  });

  it("rejects a changed or lost number", () => {
    const r = acceptUiTranslations(source, { a: "x", b: "{pct}% y", c: "911 पर कॉल करें", d: "{n}/{m}" });
    expect(r.rejected.find((x) => x.key === "c")?.reason).toMatch(/number/);
  });

  it("rejects missing, empty and runaway output; accepted keys stay usable", () => {
    const r = acceptUiTranslations(source, { a: "   ", b: "{pct}% " + "x".repeat(500), d: "{n} {m}" });
    expect(r.rejected.map((x) => x.key).sort()).toEqual(["a", "b", "c"]);
    expect(r.accepted).toEqual({ d: "{n} {m}" });
  });

  it("survives garbage input without throwing", () => {
    for (const bad of [null, undefined, "text", 42, [], { a: 5 }]) {
      expect(() => acceptUiTranslations(source, bad)).not.toThrow();
      expect(Object.keys(acceptUiTranslations(source, bad).accepted)).toEqual([]);
    }
  });

  it("the real English catalogue round-trips through itself", async () => {
    const { en } = await import("./messages");
    const r = acceptUiTranslations(en, en);
    expect(r.rejected).toEqual([]);
  });
});

describe("acceptKbTranslation", () => {
  const good = {
    title: "पीएम श्रम योगी मान-धन (PM-SYM) पेंशन",
    summary: "असंगठित मज़दूरों के लिए एक पेंशन योजना। 60 साल के बाद तय पेंशन मिलती है।",
    eligibility: ["उम्र 18 से 40 साल", "महीने की आमदनी ₹15,000 या कम", "EPFO, ESIC या NPS के सदस्य नहीं", "आयकर दाता नहीं"],
  };

  it("accepts a faithful translation of the fields given", () => {
    const r = acceptKbTranslation(pmsym, good);
    expect(r.rejected).toEqual([]);
    expect(r.accepted.title).toBe(good.title);
    expect(r.accepted.eligibility).toHaveLength(4);
  });

  it("rejects a list with a different number of items (items would misalign)", () => {
    const r = acceptKbTranslation(pmsym, { eligibility: good.eligibility.slice(0, 3) });
    expect(r.rejected[0].key).toBe("scheme.pmsym.eligibility");
    expect(r.accepted.eligibility).toBeUndefined();
  });

  it("rejects a changed age or amount, and keeps the rest", () => {
    const r = acceptKbTranslation(pmsym, { ...good, eligibility: ["उम्र 18 से 45 साल", ...good.eligibility.slice(1)] });
    expect(r.rejected.map((x) => x.key)).toEqual(["scheme.pmsym.eligibility"]);
    expect(r.accepted.title).toBeDefined();
  });

  it("rejects fields the English entry does not have (no inventing a 'steps' list)", () => {
    const r = acceptKbTranslation(pmsym, { steps: ["a", "b"] });
    expect(r.rejected[0].reason).toMatch(/no such field/);
  });

  it("rejects the wrong shape entirely", () => {
    expect(acceptKbTranslation(pmsym, "just a string").accepted).toEqual({});
    expect(acceptKbTranslation(pmsym, { title: 5 }).rejected).toHaveLength(1);
  });

  it("every English entry round-trips through its own translatable fields", () => {
    for (const id of ["scheme.pmsym", "scheme.eshram", "right.deactivation_id_block", "safety.accident_steps", "grievance.short_payment"]) {
      const e = getEntry(id)!;
      const r = acceptKbTranslation(e, translatableFields(e));
      expect(r.rejected, id).toEqual([]);
    }
  });

  it("translatableFields leaves out ids, status, links and helplines", () => {
    const f = translatableFields(eshram);
    expect(Object.keys(f).sort()).toEqual(["benefits", "documents_needed", "eligibility", "how_to_apply", "status_note", "summary", "title"]);
    expect(JSON.stringify(f)).not.toMatch(/source_url|helpline|"status"/);
  });
});

describe("localizeEntry", () => {
  const hindi = {
    "scheme.pmsym": {
      title: "पीएम श्रम योगी मान-धन पेंशन",
      eligibility: ["उम्र 18 से 40 साल", "महीने की आमदनी ₹15,000 या कम", "EPFO, ESIC या NPS के सदस्य नहीं", "आयकर दाता नहीं"],
    },
  };

  it("returns English untouched", () => {
    expect(localizeEntry(pmsym, "en", { hi: hindi })).toBe(pmsym);
  });

  it("uses a valid translation and keeps every non-translated field exactly", () => {
    const out = localizeEntry(pmsym, "hi", { hi: hindi });
    expect(out.title).toBe("पीएम श्रम योगी मान-धन पेंशन");
    expect(out.summary).toBe(pmsym.summary); // not translated, falls back per field
    expect(out.id).toBe(pmsym.id);
    expect(out.status).toBe(pmsym.status);
    expect(out.source_url).toBe(pmsym.source_url);
    expect(out.helpline).toBe(pmsym.helpline);
  });

  it("falls back to English for a language or entry with no translation", () => {
    expect(localizeEntry(pmsym, "ta", {})).toBe(pmsym);
    expect(localizeEntry(eshram, "hi", { hi: hindi })).toBe(eshram);
  });

  it("a bad hand-edited translation can only fall back to English, never show a wrong number", () => {
    const bad = { "scheme.pmsym": { title: "ठीक है", eligibility: ["उम्र 18 से 99 साल", "x", "y", "z"] } };
    const out = localizeEntry(pmsym, "hi", { hi: bad });
    expect(out.title).toBe("ठीक है"); // the good field is used
    expect(out.eligibility).toEqual(pmsym.eligibility); // the wrong-number list is dropped
  });

  it("reports coverage", () => {
    expect(coverage([pmsym, eshram], "hi", { hi: hindi })).toEqual({ translated: 1, total: 2 });
    expect(coverage([pmsym, eshram], "ta", {})).toEqual({ translated: 0, total: 2 });
  });

  it("the shipped (empty) tables change nothing yet", () => {
    expect(localizeEntry(pmsym, "hi")).toBe(pmsym);
  });
});

describe("helpers", () => {
  it("reads placeholders", () => {
    expect(placeholdersOf("{b} then {a}")).toEqual(["a", "b"]);
    expect(placeholdersOf("none")).toEqual([]);
  });
  it("splits into batches", () => {
    expect(batches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(batches([], 3)).toEqual([]);
  });
});
