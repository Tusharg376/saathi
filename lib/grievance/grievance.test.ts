import { beforeEach, describe, expect, it, vi } from "vitest";

const llm = vi.hoisted(() => ({ keyPresent: true, generateJSON: vi.fn() }));

vi.mock("../llm/gemini", async (orig) => {
  const real = await orig<typeof import("../llm/gemini")>();
  return { ...real, hasApiKey: () => llm.keyPresent, generateJSON: llm.generateJSON };
});

import { LlmError, toJsonSchema } from "../llm/gemini";
import { _resetRateLimit } from "../server/ratelimit";
import { handleGrievance } from "./handler";
import { GrievanceDraft, GrievanceRequest, buildGrievanceInput, buildGrievancePrompt, normalizeDraft } from "./draft";
import {
  ISSUES,
  buildTemplateLetter,
  fillPlaceholders,
  issueEntry,
  repairRedactionTokens,
  templateSubject,
  unfilled,
} from "./letter";

const LONG_LETTER =
  "Date: {{date}}\n\nTo,\nThe Grievance Officer, Swiggy\n\nSubject: Complaint\n\nI am writing about a pending payment of Rs 1,200 for 12 October.\n\nYours faithfully,\n{{name}}\nPhone: {{phone}}\n{{city}}";

const rawDraft = (over: Partial<GrievanceDraft> = {}): GrievanceDraft => ({
  needs_info: false,
  questions: [],
  subject: "Complaint: payment short",
  letter: LONG_LETTER,
  summary_for_worker: "This letter asks Swiggy to pay Rs 1,200.",
  evidence: ["Screenshot of earnings"],
  ...over,
});

describe("issues and the KB", () => {
  it("every issue has a KB entry with a real escalation route and an evidence list", () => {
    for (const i of ISSUES) {
      const e = issueEntry(i);
      expect(e, i).toBeDefined();
      expect(e!.steps?.length, `${i} steps`).toBeGreaterThanOrEqual(3);
      expect(e!.documents_needed?.length, `${i} evidence`).toBeGreaterThanOrEqual(2);
      expect(e!.source_url.startsWith("https://")).toBe(true);
    }
  });

  it("never states a legal deadline: wait times are labelled as suggestions", () => {
    for (const i of ISSUES) {
      const steps = (issueEntry(i)!.steps ?? []).join(" ");
      if (/\b15 days\b/.test(steps)) expect(steps, i).toMatch(/not a legal limit/);
    }
  });
});

describe("placeholders", () => {
  it("fills the worker's details locally", () => {
    const out = fillPlaceholders("Hi {{name}}, call {{ phone }} from {{city}} on {{date}}", {
      name: "Raju Kumar",
      phone: "9876543210",
      city: "Lucknow",
      date: "17 October 2026",
    });
    expect(out).toBe("Hi Raju Kumar, call 9876543210 from Lucknow on 17 October 2026");
  });

  it("leaves a visible gap for anything not provided, never a blank", () => {
    const out = fillPlaceholders("{{name}} {{phone}} {{city}} {{date}}", { name: "  ", phone: undefined });
    expect(out).toBe("[YOUR NAME] [YOUR PHONE] [YOUR CITY] [DATE]");
  });

  it("is case-insensitive and fills repeated placeholders", () => {
    expect(fillPlaceholders("{{NAME}} / {{Name}}", { name: "A" })).toBe("A / A");
  });

  it("reports what is still unfilled so the worker fixes it before sending", () => {
    const text = fillPlaceholders(LONG_LETTER, { name: "Raju" }) + "\nOrder [ADD: order number]";
    expect(unfilled(text).sort()).toEqual(["[ADD: order number]", "[DATE]", "[YOUR CITY]", "[YOUR PHONE]"].sort());
    expect(unfilled(fillPlaceholders(LONG_LETTER, { name: "R", phone: "1", city: "C", date: "D" }))).toEqual([]);
  });

  it("turns redaction tokens into placeholders or an explicit gap, never a raw [PHONE]", () => {
    const out = repairRedactionTokens("Call [PHONE]. Aadhaar [AADHAAR], PAN [PAN], account [ACCOUNT].");
    expect(out).toContain("{{phone}}");
    expect(out).not.toMatch(/\[(PHONE|AADHAAR|PAN|ACCOUNT)\]/);
    expect(out).toContain("[ADD: number, only if the office asks for it]");
  });
});

describe("buildTemplateLetter (no AI)", () => {
  const desc = "Swiggy did not pay me for 12 October. The app showed Rs 1,200.";

  it("includes the worker's own words unchanged", () => {
    expect(buildTemplateLetter("short_payment", desc)).toContain(desc);
  });

  it("addresses the right recipient for each kind of complaint", () => {
    expect(buildTemplateLetter("short_payment", desc, { party: "Swiggy" })).toContain("The Grievance Officer, Swiggy");
    expect(buildTemplateLetter("wage_theft", desc, { party: "Sharma Contractors" })).toContain(
      "The Labour Commissioner",
    );
    expect(buildTemplateLetter("challan", desc)).toContain("traffic challans");
    expect(buildTemplateLetter("harassment", desc, { party: "Uber" })).toContain("Safety Team");
  });

  it("states details and a clear request, and asks for a reply politely", () => {
    const l = buildTemplateLetter("short_payment", desc, {
      party: "Swiggy",
      dates: "12 Oct 2026",
      amountInr: 120000,
      ids: "ORD123",
    });
    expect(l).toContain("Against: Swiggy");
    expect(l).toContain("Date(s): 12 Oct 2026");
    expect(l).toContain("Rs 1,20,000");
    expect(l).toContain("ORD123");
    expect(l).toMatch(/Please pay the amount/);
    expect(l).toMatch(/reply within 15 days/);
  });

  it("uses placeholders for contact details and lists the evidence it can provide", () => {
    const l = buildTemplateLetter("deactivation", desc);
    for (const p of ["{{date}}", "{{name}}", "{{phone}}", "{{city}}"]) expect(l).toContain(p);
    expect(l).toContain("Screenshot of the block message");
  });

  it("makes no threats and cites no law", () => {
    for (const i of ISSUES) {
      const l = buildTemplateLetter(i, desc);
      // Whole words only: "issued" must not trip the word "sue".
      expect(l, i).not.toMatch(/\b(sue|suing|court|legal action|lawyer)\b|section \d|\bact,? \d{4}|FIR will/i);
    }
  });

  it("has a subject line for every issue", () => {
    for (const i of ISSUES) expect(templateSubject(i).length).toBeGreaterThan(10);
  });

  it("a filled template has no unresolved placeholders except what the worker left out", () => {
    const filled = fillPlaceholders(buildTemplateLetter("short_payment", desc), {
      name: "R",
      phone: "1",
      city: "C",
      date: "D",
    });
    expect(unfilled(filled)).toEqual([]);
  });
});

describe("normalizeDraft", () => {
  it("returns a complete draft", () => {
    const d = normalizeDraft(rawDraft(), false)!;
    expect(d.needsInfo).toBe(false);
    expect(d.letter).toContain("{{name}}");
    expect(d.summary).toMatch(/Swiggy/);
  });

  it("returns questions in the first round when essentials are missing", () => {
    const d = normalizeDraft(
      rawDraft({ needs_info: true, questions: ["Which app?", "When?"], letter: "", summary_for_worker: "" }),
      false,
    )!;
    expect(d).toMatchObject({ needsInfo: true, questions: ["Which app?", "When?"], letter: "" });
  });

  it("enforces one round: after the final round the model may not keep asking", () => {
    const stubborn = rawDraft({ needs_info: true, questions: ["Still need more?"] });
    const d = normalizeDraft(stubborn, true)!;
    expect(d.needsInfo).toBe(false);
    expect(d.letter.length).toBeGreaterThan(60);
  });

  it("ignores needs_info when there are no actual questions", () => {
    expect(normalizeDraft(rawDraft({ needs_info: true, questions: [] }), false)!.needsInfo).toBe(false);
  });

  it("caps questions at three", () => {
    const d = normalizeDraft(rawDraft({ needs_info: true, questions: ["a", "b", "c", "d"], letter: "" }), false)!;
    expect(d.questions).toHaveLength(3);
  });

  it("returns null when there is no usable letter, so the caller can fall back", () => {
    expect(normalizeDraft(rawDraft({ letter: "short" }), false)).toBeNull();
    expect(normalizeDraft(rawDraft({ letter: "", needs_info: true, questions: [] }), true)).toBeNull();
  });

  it("repairs redaction tokens inside the letter", () => {
    const d = normalizeDraft(rawDraft({ letter: LONG_LETTER + "\nCall me on [PHONE]. Aadhaar [AADHAAR]." }), false)!;
    expect(d.letter).not.toMatch(/\[PHONE\]|\[AADHAAR\]/);
  });

  it("bounds field lengths", () => {
    const long = "x".repeat(10_000);
    const d = normalizeDraft(
      rawDraft({ letter: long, subject: long, summary_for_worker: long, evidence: [long] }),
      false,
    )!;
    expect(d.letter.length).toBeLessThanOrEqual(4000);
    expect(d.subject.length).toBeLessThanOrEqual(140);
    expect(d.summary.length).toBeLessThanOrEqual(800);
    expect(d.evidence[0].length).toBeLessThanOrEqual(160);
  });
});

describe("prompt and input", () => {
  const p = (final = false) =>
    buildGrievancePrompt({ issue: "short_payment", langName: "Hindi", letterLangName: "English", final });

  it("sets the safety rules the letter must follow", () => {
    for (const needle of ["NEVER", "threaten", "{{name}}", "{{phone}}", "invent", "DATA", "[ADD:"])
      expect(p(), needle).toContain(needle);
  });

  it("gives the model the real escalation route and evidence from the KB, not its own guess", () => {
    expect(p()).toContain("escalated");
    expect(p()).toContain("Screenshots of the earnings screen");
  });

  it("allows questions only before the final round", () => {
    expect(p(false)).toMatch(/needs_info to true/);
    expect(p(true)).toMatch(/Do NOT ask questions/);
  });

  it("names both languages", () => {
    const text = buildGrievancePrompt({
      issue: "deactivation",
      langName: "Tamil",
      letterLangName: "Tamil",
      final: false,
    });
    expect(text).toContain("in Tamil");
  });

  it("is a plain schema the model can follow", () => {
    const s = JSON.stringify(toJsonSchema(GrievanceDraft));
    expect(s).not.toContain('"default"');
    expect(s).not.toContain('"anyOf"');
  });

  it("redacts ID numbers from everything shown to the model", () => {
    const input = buildGrievanceInput(
      GrievanceRequest.parse({
        issue: "short_payment",
        lang: "hi",
        letterLang: "en",
        description: "They did not pay. My phone 9876543210 and aadhaar 2345 6789 0123.",
        details: { party: "Swiggy", ids: "ORD-1, call 9876543210" },
        answers: [{ q: "When?", a: "12 Oct. Call 9876543210" }],
      }),
    );
    expect(input).not.toMatch(/9876543210|2345 6789 0123/);
    expect(input).toContain("Against: Swiggy");
    expect(input).toContain("follow-up");
  });
});

describe("GrievanceRequest", () => {
  const ok = { issue: "penalty", lang: "hi", letterLang: "en", description: "They cut Rs 400 wrongly." };
  it("accepts a valid request and rejects bad ones", () => {
    expect(GrievanceRequest.safeParse(ok).success).toBe(true);
    expect(GrievanceRequest.safeParse({ ...ok, issue: "revenge" }).success).toBe(false);
    expect(GrievanceRequest.safeParse({ ...ok, description: "short" }).success).toBe(false);
    expect(GrievanceRequest.safeParse({ ...ok, description: "x".repeat(3001) }).success).toBe(false);
    expect(GrievanceRequest.safeParse({ ...ok, letterLang: "fr" }).success).toBe(false);
    expect(GrievanceRequest.safeParse({ ...ok, answers: Array(4).fill({ q: "q", a: "a" }) }).success).toBe(false);
    expect(GrievanceRequest.safeParse({ ...ok, details: { amountInr: -5 } }).success).toBe(false);
  });
});

describe("handleGrievance", () => {
  const post = (body: unknown, ip = "5.5.5.5") =>
    new Request("http://x/api/grievance", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    });
  const ok = {
    issue: "short_payment",
    lang: "hi",
    letterLang: "en",
    description: "Swiggy did not pay me Rs 1200 for 12 October.",
  };

  beforeEach(() => {
    llm.keyPresent = true;
    llm.generateJSON.mockReset();
    llm.generateJSON.mockResolvedValue(rawDraft());
    _resetRateLimit();
  });

  it("returns a normalised draft", async () => {
    const res = await handleGrievance(post(ok));
    expect(res.status).toBe(200);
    const { draft } = await res.json();
    expect(draft.needsInfo).toBe(false);
    expect(draft.letter).toContain("{{name}}");
  });

  it("never sends contact details or ID numbers to the model", async () => {
    await handleGrievance(post({ ...ok, description: ok.description + " Call me 9876543210, aadhaar 2345 6789 0123" }));
    const sent = JSON.stringify(llm.generateJSON.mock.calls[0][0]);
    expect(sent).not.toMatch(/9876543210|2345 6789 0123/);
  });

  it("passes the final flag through so the model stops asking", async () => {
    await handleGrievance(post({ ...ok, final: true }));
    expect(llm.generateJSON.mock.calls[0][2].system).toMatch(/Do NOT ask questions/);
  });

  it("returns questions in round one", async () => {
    llm.generateJSON.mockResolvedValue(
      rawDraft({ needs_info: true, questions: ["Which app?"], letter: "", summary_for_worker: "" }),
    );
    const { draft } = await (await handleGrievance(post(ok))).json();
    expect(draft).toMatchObject({ needsInfo: true, questions: ["Which app?"] });
  });

  it("returns 502 when the model produced no usable letter, so the client falls back to the template", async () => {
    llm.generateJSON.mockResolvedValue(rawDraft({ letter: "" }));
    expect((await handleGrievance(post(ok))).status).toBe(502);
  });

  it("503 with no key, 400 on bad input, 429 and 502 on provider failure, without leaking details", async () => {
    llm.keyPresent = false;
    expect((await handleGrievance(post(ok))).status).toBe(503);
    llm.keyPresent = true;
    expect((await handleGrievance(post({ issue: "x" }))).status).toBe(400);
    llm.generateJSON.mockRejectedValueOnce(new LlmError("quota", 429));
    expect((await handleGrievance(post(ok))).status).toBe(429);
    llm.generateJSON.mockRejectedValueOnce(new Error("secret key=abc"));
    const res = await handleGrievance(post(ok));
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toMatch(/secret|abc/);
  });

  it("rate limits per client", async () => {
    let last = 200;
    for (let i = 0; i < 25; i++) last = (await handleGrievance(post(ok, "6.6.6.6"))).status;
    expect(last).toBe(429);
  });
});
