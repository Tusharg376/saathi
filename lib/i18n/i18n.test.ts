import { describe, expect, it } from "vitest";
import { DEFAULT_LANG, HELPLINE_LABEL, LANGUAGES, en, hi, isLangCode, translate, type MessageKey } from "./messages";
import { LangSchema } from "./lang-schema";
import { getHelpline } from "../kb";

const keys = Object.keys(en) as MessageKey[];
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("languages", () => {
  it("the request schema accepts exactly the launch languages", () => {
    expect([...LangSchema.options].sort()).toEqual(LANGUAGES.map((l) => l.code).sort());
  });

  it("each language has a native name and a speech tag", () => {
    for (const l of LANGUAGES) {
      expect(l.native.length, l.code).toBeGreaterThan(0);
      expect(l.speech, l.code).toMatch(/^[a-z]{2}-IN$/);
    }
  });

  it("recognises codes and rejects junk", () => {
    expect(isLangCode("hi")).toBe(true);
    expect(isLangCode("fr")).toBe(false);
    expect(isLangCode(undefined)).toBe(false);
    expect(LANGUAGES.some((l) => l.code === DEFAULT_LANG)).toBe(true);
  });
});

describe("catalogues", () => {
  it("Hindi covers every English key with a non-empty string", () => {
    for (const k of keys) expect(hi[k]?.trim(), k).toBeTruthy();
  });

  it("Hindi keeps exactly the same {placeholders} as English, so none ever prints raw", () => {
    for (const k of keys) expect(placeholders(hi[k]), `${k}: ${hi[k]}`).toEqual(placeholders(en[k]));
  });

  it("Hindi strings are actually translated, not left as English", () => {
    const sameAsEnglish = keys.filter((k) => hi[k] === en[k]);
    // Legitimately identical: the emergency "SOS" and the brand name "WhatsApp".
    // Anything beyond that is a missed translation.
    expect(sameAsEnglish.sort()).toEqual(["cmp.whatsapp", "top.sos"]);
  });
});

describe("translate", () => {
  it("returns the language's own string", () => {
    expect(translate("hi", "nav.earnings")).toBe("कमाई");
    expect(translate("en", "nav.earnings")).toBe("Earnings");
  });

  it("falls back to English for a language with no catalogue yet", () => {
    expect(translate("ta", "nav.earnings")).toBe("Earnings");
  });

  it("fills placeholders and leaves unknown ones visible rather than hiding the bug", () => {
    expect(translate("en", "earn.up", { pct: 12 })).toBe("12% more than the 7 days before");
    expect(translate("en", "earn.up")).toContain("{pct}");
    expect(translate("en", "earn.up", { other: 1 })).toContain("{pct}");
  });
});

describe("helpline labels", () => {
  it("only label helplines that exist in the KB, with keys that exist", () => {
    for (const [id, key] of Object.entries(HELPLINE_LABEL)) {
      expect(getHelpline(id), id).toBeDefined();
      expect(en[key], key).toBeTruthy();
    }
  });
});
