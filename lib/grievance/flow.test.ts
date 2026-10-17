import { describe, expect, it } from "vitest";
import type { FetchLike } from "../http/postJson";
import { runDraft, startingPoint, type FlowInput } from "./flow";
import { EMPTY_FIELDS } from "./request";

const reply =
  (status: number, body: unknown): FetchLike =>
  async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const input = (over: Partial<FlowInput> = {}): FlowInput => ({
  issue: "short_payment",
  lang: "hi",
  letterLang: "en",
  description: "Swiggy did not pay me Rs 1200 for 12 October.",
  fields: { ...EMPTY_FIELDS, party: "Swiggy" },
  contact: { name: "Raju", phone: "9876543210", city: "Lucknow" },
  date: "17 October 2026",
  final: false,
  ...over,
});
const draft = {
  needsInfo: false,
  questions: [],
  subject: "S",
  letter: "Date: {{date}}\n{{name}}",
  summary: "It asks for payment.",
  evidence: [],
};

describe("startingPoint", () => {
  it("is blank when nothing was handed over", () => {
    expect(startingPoint()).toEqual({ issue: null, description: "", fields: EMPTY_FIELDS });
  });
  it("fills in what another screen knew", () => {
    expect(
      startingPoint({
        issue: "penalty",
        party: "Swiggy",
        dates: "16 October 2026",
        amountInr: 450,
        description: "They cut Rs 450.",
      }),
    ).toEqual({
      issue: "penalty",
      description: "They cut Rs 450.",
      fields: { party: "Swiggy", dates: "16 October 2026", amount: "450", ids: "" },
    });
  });
  it("leaves the amount blank when there is none", () => {
    expect(startingPoint({ issue: "challan" }).fields.amount).toBe("");
  });
});

describe("runDraft", () => {
  it("asks for more detail without calling the server when the description is too short", async () => {
    let called = false;
    const spy: FetchLike = async () => ((called = true), { ok: true, status: 200, json: async () => ({}) });
    expect(await runDraft(input({ description: "short" }), spy)).toEqual({ kind: "error", key: "cmp.desc_short" });
    expect(called).toBe(false);
  });

  it("returns a letter with the worker's details filled in locally", async () => {
    const r = await runDraft(input(), reply(200, { draft }));
    expect(r.kind).toBe("view");
    if (r.kind === "view") expect(r.view.letter).toBe("Date: 17 October 2026\nRaju");
  });

  it("passes the model's questions on", async () => {
    const asking = { ...draft, needsInfo: true, questions: ["Which app?"], letter: "" };
    expect(await runDraft(input(), reply(200, { draft: asking }))).toEqual({
      kind: "questions",
      questions: ["Which app?"],
    });
  });

  it("falls back to the offline template when the AI is off, so the worker still gets a letter", async () => {
    const r = await runDraft(input(), reply(503, { error: "no_key" }));
    expect(r.kind).toBe("view");
    if (r.kind === "view") {
      expect(r.view.notice).toBe("cmp.no_ai");
      expect(r.view.letter).toContain("Swiggy did not pay me Rs 1200");
      expect(r.view.letter).toContain("Raju");
    }
  });

  it("falls back to the template when offline", async () => {
    const offline: FetchLike = async () => {
      throw new TypeError("Failed to fetch");
    };
    const r = await runDraft(input(), offline);
    expect(r.kind === "view" && r.view.notice).toBe("cmp.fail_ai");
  });

  it("tells the worker to wait on a rate limit, instead of writing a template", async () => {
    expect(await runDraft(input(), reply(429, { error: "rate_limited" }))).toEqual({
      kind: "error",
      key: "cmp.err.rate",
    });
  });

  it("sends only the answered questions, and never the worker's name or phone", async () => {
    let body = "";
    const spy: FetchLike = async (_u, init) => (
      (body = String(init.body)),
      { ok: true, status: 200, json: async () => ({ draft }) }
    );
    await runDraft(input({ final: true, questions: ["Which app?", "When?"], answers: ["Swiggy", ""] }), spy);
    const sent = JSON.parse(body);
    expect(sent.answers).toEqual([{ q: "Which app?", a: "Swiggy" }]);
    expect(sent.final).toBe(true);
    expect(body).not.toMatch(/Raju|9876543210/);
  });
});
