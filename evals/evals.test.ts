import { describe, expect, it } from "vitest";
import { getEntry } from "../lib/kb";
import { GrievanceRequest } from "../lib/grievance/draft";
import { LANGUAGES } from "../lib/i18n/messages";
import { CASES, type ChatCase } from "./cases";
import {
  avgSentenceWords,
  dominantScript,
  evaluateCheck,
  evaluateLetter,
  evaluateParse,
  hasMarkdown,
  type Script,
} from "./checks";

describe("the golden dataset is sound", () => {
  it("has unique ids", () => {
    const ids = CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every product area, with the red-team set in particular", () => {
    const count = (a: string) => CASES.filter((c) => c.area === a).length;
    expect(count("rights")).toBeGreaterThanOrEqual(10);
    expect(count("safety")).toBeGreaterThanOrEqual(6);
    expect(count("earnings")).toBeGreaterThanOrEqual(6);
    expect(count("grievance")).toBeGreaterThanOrEqual(3);
    expect(count("redteam")).toBeGreaterThanOrEqual(8);
  });

  it("exercises every launch language", () => {
    const langs = new Set(CASES.filter((c): c is ChatCase => c.kind === "chat").map((c) => c.lang));
    for (const l of LANGUAGES) expect(langs.has(l.code), `no case in ${l.code}`).toBe(true);
  });

  it("every chat case has a real check beyond the baseline", () => {
    for (const c of CASES.filter((x): x is ChatCase => x.kind === "chat")) {
      expect(c.checks.length, c.id).toBeGreaterThan(2); // plain_text + sentence length + at least one more
    }
  });

  it("every cited KB id exists, so a typo cannot silently make a case unfailable", () => {
    for (const c of CASES.filter((x): x is ChatCase => x.kind === "chat")) {
      for (const ch of c.checks)
        if (ch.kind === "cites") for (const id of ch.anyOf) expect(getEntry(id), `${c.id}: ${id}`).toBeDefined();
    }
  });

  it("the script a case expects matches the language it is written in", () => {
    const expected: Record<string, Script[]> = {
      hi: ["devanagari", "latin"],
      mr: ["devanagari"],
      bn: ["bengali"],
      ta: ["tamil"],
      te: ["telugu"],
      kn: ["kannada"],
      gu: ["gujarati"],
      en: ["latin"],
    };
    for (const c of CASES.filter((x): x is ChatCase => x.kind === "chat")) {
      for (const ch of c.checks) if (ch.kind === "script") expect(expected[c.lang], c.id).toContain(ch.script);
    }
  });

  it("each chat message is actually written in its stated language", () => {
    const want: Record<string, Script[]> = {
      mr: ["devanagari"],
      bn: ["bengali"],
      ta: ["tamil"],
      te: ["telugu"],
      kn: ["kannada"],
      gu: ["gujarati"],
    };
    for (const c of CASES.filter((x): x is ChatCase => x.kind === "chat" && x.lang in want)) {
      expect(want[c.lang], c.id).toContain(dominantScript(c.message));
    }
  });

  it("grievance requests are valid against the real request schema", () => {
    for (const c of CASES.filter((x) => x.kind === "grievance")) {
      if (c.kind === "grievance") expect(GrievanceRequest.safeParse(c.request).success, c.id).toBe(true);
    }
  });

  it("includes an emergency case and a not-an-emergency case, so the detector is checked both ways", () => {
    const flags = CASES.filter((c): c is ChatCase => c.kind === "chat").flatMap((c) =>
      c.checks.filter((k) => k.kind === "emergency"),
    );
    expect(flags.some((k) => k.kind === "emergency" && k.expected)).toBe(true);
    expect(flags.some((k) => k.kind === "emergency" && !k.expected)).toBe(true);
  });
});

describe("script detection", () => {
  it("identifies each launch language's script", () => {
    expect(dominantScript("नमस्ते दोस्त")).toBe("devanagari");
    expect(dominantScript("தமிழ் மொழி")).toBe("tamil");
    expect(dominantScript("తెలుగు భాష")).toBe("telugu");
    expect(dominantScript("ಕನ್ನಡ ಭಾಷೆ")).toBe("kannada");
    expect(dominantScript("বাংলা ভাষা")).toBe("bengali");
    expect(dominantScript("ગુજરાતી ભાષા")).toBe("gujarati");
    expect(dominantScript("hello there")).toBe("latin");
  });
  it("picks the majority script in mixed text, and null for no letters", () => {
    expect(dominantScript("PM-SYM एक पेंशन योजना है। 60 साल के बाद")).toBe("devanagari");
    expect(dominantScript("mera ID block ho gaya, kya karun? Call 14434")).toBe("latin");
    expect(dominantScript("123 456 !!")).toBeNull();
  });
});

describe("simple-language proxy", () => {
  it("measures words per sentence, including the Devanagari danda", () => {
    expect(avgSentenceWords("One two three. Four five.")).toBe(2.5);
    expect(avgSentenceWords("यह एक वाक्य है। यह दूसरा है।")).toBe(3.5);
    expect(avgSentenceWords("")).toBe(0);
  });
  it("detects markdown that would be read aloud as symbols", () => {
    expect(hasMarkdown("**bold** text")).toBe(true);
    expect(hasMarkdown("# Heading")).toBe(true);
    expect(hasMarkdown("- a list item")).toBe(true);
    expect(hasMarkdown("1. Go to the CSC.\n2. Carry Aadhaar.")).toBe(false);
    expect(hasMarkdown("Plain sentence. Another one.")).toBe(false);
  });
});

describe("evaluateCheck", () => {
  const r = { text: "Call 108 now. PM-SYM is a pension.", sourceIds: ["scheme.pmsym"], emergency: true };

  const pass = (check: Parameters<typeof evaluateCheck>[0]) => evaluateCheck(check, r)?.pass;

  it("checks citations", () => {
    expect(pass({ kind: "cites", anyOf: ["scheme.pmsym"] })).toBe(true);
    expect(pass({ kind: "cites", anyOf: ["scheme.eshram"] })).toBe(false);
  });
  it("checks what the answer says and must not say", () => {
    expect(pass({ kind: "mentions", anyOf: ["108", "112"] })).toBe(true);
    expect(pass({ kind: "mentions", anyOf: ["1930"] })).toBe(false);
    expect(pass({ kind: "mentions_none", of: ["fraud@ybl"] })).toBe(true);
    expect(pass({ kind: "mentions_none", of: ["108"] })).toBe(false);
  });
  it("checks the emergency flag", () => {
    expect(pass({ kind: "emergency", expected: true })).toBe(true);
    expect(pass({ kind: "emergency", expected: false })).toBe(false);
  });
  it("checks the script, sentence length and plain text", () => {
    expect(pass({ kind: "script", script: "latin" })).toBe(true);
    expect(pass({ kind: "script", script: "tamil" })).toBe(false);
    expect(pass({ kind: "max_avg_sentence_words", n: 5 })).toBe(true);
    expect(pass({ kind: "max_avg_sentence_words", n: 2 })).toBe(false);
    expect(pass({ kind: "plain_text" })).toBe(true);
  });

  it("leaves LLM-judged checks to the live runner", () => {
    expect(evaluateCheck({ kind: "judge", rubric: "x" }, r)).toBeNull();
  });

  it("explains failures", () => {
    expect(evaluateCheck({ kind: "cites", anyOf: ["scheme.eshram"] }, r)?.detail).toMatch(/scheme\.pmsym/);
  });
});

describe("evaluateParse", () => {
  const entry = {
    date: "2026-10-17",
    platform: "Swiggy",
    grossInr: 1850,
    deductionsInr: 0,
    fuelInr: 400,
    otherCostInr: 0,
    orders: 12,
  };

  it("passes when every expected field matches", () => {
    const out = evaluateParse({ entry: { grossInr: 1850, fuelInr: 400, orders: 12, platformIncludes: "swiggy" } }, [
      entry,
    ]);
    expect(out.every((o) => o.pass)).toBe(true);
  });
  it("fails on a wrong number", () => {
    expect(evaluateParse({ entry: { grossInr: 1800 } }, [entry]).some((o) => !o.pass)).toBe(true);
  });
  it("fails when nothing was extracted but something was expected", () => {
    expect(evaluateParse({ entry: { grossInr: 1 } }, []).every((o) => !o.pass)).toBe(true);
  });
  it("noEntries passes only when nothing was invented", () => {
    expect(evaluateParse({ noEntries: true }, []).every((o) => o.pass)).toBe(true);
    expect(evaluateParse({ noEntries: true }, [entry]).some((o) => !o.pass)).toBe(true);
  });
  it("catches an amount that an injection tried to add", () => {
    expect(evaluateParse({ forbidAmount: 99999 }, [{ ...entry, grossInr: 99999 }]).some((o) => !o.pass)).toBe(true);
    expect(evaluateParse({ forbidAmount: 99999 }, [entry]).every((o) => o.pass)).toBe(true);
  });
});

describe("evaluateLetter", () => {
  const good =
    "Date: {{date}}\nTo,\nThe Grievance Officer, Swiggy\nI am owed Rs 1200.\nYours faithfully,\n{{name}}\nPhone: {{phone}}";

  it("passes a clean letter that uses placeholders and the worker's facts", () => {
    expect(evaluateLetter({ includes: ["Swiggy", "1200"], placeholdersOnly: true }, good).every((o) => o.pass)).toBe(
      true,
    );
  });
  it("flags threats and legal claims", () => {
    for (const bad of [
      "I will sue you.",
      "I will go to court.",
      "Under section 12 you must pay.",
      "I will take legal action.",
    ]) {
      expect(
        evaluateLetter({}, good + "\n" + bad).some((o) => !o.pass),
        bad,
      ).toBe(true);
    }
  });
  it("does not mistake 'issued' for 'sue'", () => {
    expect(evaluateLetter({}, good + "\nThe challan was issued in error.").every((o) => o.pass)).toBe(true);
  });
  it("flags a raw phone number or redaction token in the letter", () => {
    expect(evaluateLetter({ placeholdersOnly: true }, good + "\nCall 9876543210").some((o) => !o.pass)).toBe(true);
    expect(evaluateLetter({ placeholdersOnly: true }, good + "\nCall [PHONE]").some((o) => !o.pass)).toBe(true);
  });
  it("flags missing facts", () => {
    expect(evaluateLetter({ includes: ["Zomato"] }, good).some((o) => !o.pass)).toBe(true);
  });
});
