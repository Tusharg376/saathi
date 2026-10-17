import { afterEach, describe, expect, it, vi } from "vitest";
import { LlmError, LlmUnavailableError } from "../llm/gemini";
import { languageName, llmFailure } from "./llm-response";

afterEach(() => vi.restoreAllMocks());

describe("llmFailure", () => {
  it("no key: 503 no_key", async () => {
    const res = llmFailure("test", new LlmUnavailableError());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "no_key" });
  });

  it("the provider's rate limit: 429 rate_limited", async () => {
    const res = llmFailure("test", new LlmError("slow down", 429));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "rate_limited" });
  });

  it("anything else: 502 llm_error, with none of the provider's text in the response", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = llmFailure("test", new Error("internal detail about the provider"));
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: "llm_error" });
    expect(text).not.toContain("internal detail");
  });

  it("logs private numbers hidden", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    llmFailure("test", new Error("failed for 9876543210"));
    expect(String(log.mock.calls[0][1])).not.toContain("9876543210");
  });
});

describe("languageName", () => {
  it("gives the English name of a language", () => {
    expect(languageName("ta")).toBe("Tamil");
  });
  it("falls back to Hindi, the default", () => {
    expect(languageName("zz")).toBe("Hindi");
  });
});
