import { describe, expect, it } from "vitest";
import type { FetchLike } from "../http/postJson";
import { requestInsight, requestParse } from "./client";
import type { InsightRequest, ParseRequest } from "./parse";
import { requestDocument } from "../documents/client";
import type { DocumentRequest } from "../documents/insight";

const reply =
  (status: number, body: unknown): FetchLike =>
  async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const offline: FetchLike = async () => {
  throw new TypeError("Failed to fetch");
};

const parseReq: ParseRequest = { text: "aaj 1850", lang: "hi", today: "2026-10-17" };
const entry = { date: "2026-10-17", platform: "Swiggy", grossInr: 1850, deductionsInr: 0, fuelInr: 0, otherCostInr: 0 };

describe("requestParse", () => {
  it("returns entries to confirm", async () => {
    expect(await requestParse(parseReq, reply(200, { entries: [entry] }))).toEqual({ kind: "entries", entries: [entry] });
  });
  it("returns the model's question when nothing could be read", async () => {
    expect(await requestParse(parseReq, reply(200, { entries: [], question: "Kitne rupaye?" }))).toEqual({
      kind: "question",
      question: "Kitne rupaye?",
    });
  });
  it("maps every failure to a kind the UI can show", async () => {
    expect(await requestParse(parseReq, reply(503, { error: "no_key" }))).toEqual({ kind: "no_key" });
    expect(await requestParse(parseReq, reply(429, { error: "rate_limited" }))).toEqual({ kind: "rate_limited" });
    expect(await requestParse(parseReq, reply(502, { error: "llm_error" }))).toEqual({ kind: "failed" });
    expect(await requestParse(parseReq, offline)).toEqual({ kind: "offline" });
  });
  it("an empty success is a failure, never a silent blank", async () => {
    expect(await requestParse(parseReq, reply(200, {}))).toEqual({ kind: "failed" });
    expect(await requestParse(parseReq, reply(200, { entries: [] }))).toEqual({ kind: "failed" });
  });
});

describe("requestInsight", () => {
  const req: InsightRequest = {
    lang: "hi",
    today: "2026-10-17",
    summary: { net: 1, gross: 1, deductions: 0, fuel: 0, days: 1, netPerHour: null, netChangePct: null },
    flags: [],
  };
  it("returns the explanation text", async () => {
    expect(await requestInsight(req, reply(200, { text: "Is hafte..." }))).toEqual({ kind: "text", text: "Is hafte..." });
  });
  it("maps failures", async () => {
    expect(await requestInsight(req, reply(503, { error: "no_key" }))).toEqual({ kind: "no_key" });
    expect(await requestInsight(req, reply(429, {}))).toEqual({ kind: "rate_limited" });
    expect(await requestInsight(req, offline)).toEqual({ kind: "offline" });
    expect(await requestInsight(req, reply(200, {}))).toEqual({ kind: "failed" });
  });
});

describe("requestDocument", () => {
  const req: DocumentRequest = { image: { mimeType: "image/jpeg", data: "QUJDREVGR0g=" }, lang: "hi" };
  const insight = { kind: "challan", title: "Challan" };
  it("returns the insight", async () => {
    expect(await requestDocument(req, reply(200, { insight }))).toEqual({ kind: "insight", insight });
  });
  it("maps failures, and an empty success is a failure", async () => {
    expect(await requestDocument(req, reply(503, { error: "no_key" }))).toEqual({ kind: "no_key" });
    expect(await requestDocument(req, reply(429, {}))).toEqual({ kind: "rate_limited" });
    expect(await requestDocument(req, offline)).toEqual({ kind: "offline" });
    expect(await requestDocument(req, reply(200, {}))).toEqual({ kind: "failed" });
  });
});
