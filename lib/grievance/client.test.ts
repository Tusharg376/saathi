import { describe, expect, it } from "vitest";
import { requestDraft } from "./client";
import type { GrievanceRequest, NormalizedDraft } from "./draft";

const req: GrievanceRequest = { issue: "short_payment", lang: "hi", letterLang: "en", description: "They did not pay me Rs 1200." };
const draft = (over: Partial<NormalizedDraft> = {}): NormalizedDraft => ({
  needsInfo: false,
  questions: [],
  subject: "S",
  letter: "A long enough letter body to be real, with {{name}} at the end of it all.",
  summary: "Summary",
  evidence: ["Screenshot"],
  ...over,
});
const reply = (status: number, body: unknown) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe("requestDraft", () => {
  it("returns the letter", async () => {
    const r = await requestDraft(req, reply(200, { draft: draft() }));
    expect(r).toMatchObject({ kind: "letter" });
  });

  it("returns follow-up questions in the first round", async () => {
    const r = await requestDraft(req, reply(200, { draft: draft({ needsInfo: true, questions: ["Which app?"], letter: "" }) }));
    expect(r).toEqual({ kind: "questions", questions: ["Which app?"] });
  });

  it("never loops: questions after the final round become a template", async () => {
    const r = await requestDraft({ ...req, final: true }, reply(200, { draft: draft({ needsInfo: true, questions: ["More?"], letter: "" }) }));
    expect(r).toEqual({ kind: "template", reason: "failed" });
  });

  it("falls back to a template with no AI key", async () => {
    expect(await requestDraft(req, reply(503, { error: "no_key" }))).toEqual({ kind: "template", reason: "no_key" });
  });

  it("falls back to a template when the model fails or the server errors", async () => {
    expect(await requestDraft(req, reply(502, { error: "llm_error" }))).toEqual({ kind: "template", reason: "failed" });
    expect(await requestDraft(req, reply(500, {}))).toEqual({ kind: "template", reason: "failed" });
  });

  it("falls back to a template when the network is down", async () => {
    const offline = async () => {
      throw new TypeError("Failed to fetch");
    };
    expect(await requestDraft(req, offline)).toEqual({ kind: "template", reason: "failed" });
  });

  it("reports a rate limit instead of a template, so the worker can wait and retry", async () => {
    expect(await requestDraft(req, reply(429, { error: "rate_limited" }))).toEqual({ kind: "rate_limited" });
  });

  it("treats an empty or unparseable body as a failure, not a blank letter", async () => {
    expect(await requestDraft(req, reply(200, {}))).toEqual({ kind: "template", reason: "failed" });
    expect(await requestDraft(req, reply(200, { draft: draft({ letter: "" }) }))).toEqual({ kind: "template", reason: "failed" });
    const badJson = async () => ({ ok: true, status: 200, json: async () => Promise.reject(new Error("bad")) });
    expect(await requestDraft(req, badJson)).toEqual({ kind: "template", reason: "failed" });
  });
});
