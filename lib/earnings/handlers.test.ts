import { beforeEach, describe, expect, it, vi } from "vitest";

const llm = vi.hoisted(() => ({
  keyPresent: true,
  generateJSON: vi.fn(),
  generateText: vi.fn(),
}));

vi.mock("../llm/gemini", async (orig) => {
  const real = await orig<typeof import("../llm/gemini")>();
  return {
    ...real,
    hasApiKey: () => llm.keyPresent,
    generateJSON: llm.generateJSON,
    generateText: llm.generateText,
  };
});

import { LlmError } from "../llm/gemini";
import { _resetRateLimit } from "../server/ratelimit";
import { handleInsight, handleParse } from "./handlers";

const TODAY = "2026-10-17";
const post = (body: unknown, ip = "1.1.1.1") =>
  new Request("http://x/api", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const modelEntry = {
  date: TODAY,
  platform: "Swiggy",
  grossInr: 1850,
  deductionsInr: 0,
  fuelInr: 400,
  otherCostInr: 0,
  orders: 12,
  hours: 0,
  km: 0,
};

beforeEach(() => {
  llm.keyPresent = true;
  llm.generateJSON.mockReset();
  llm.generateText.mockReset();
  llm.generateJSON.mockResolvedValue({ entries: [modelEntry], question: "" });
  llm.generateText.mockResolvedValue("Is hafte aapne Rs 8,400 bachaye.");
  _resetRateLimit();
});

describe("handleParse", () => {
  it("returns normalised entries for the worker to confirm", async () => {
    const res = await handleParse(post({ text: "aaj swiggy 12 order 1850 petrol 400", lang: "hi", today: TODAY }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toEqual([
      { date: TODAY, platform: "Swiggy", grossInr: 1850, deductionsInr: 0, fuelInr: 400, otherCostInr: 0, orders: 12 },
    ]);
  });

  it("repairs bad model output instead of returning it", async () => {
    llm.generateJSON.mockResolvedValue({
      entries: [{ ...modelEntry, date: "2030-01-01", grossInr: -5, fuelInr: 999999 }],
      question: "",
    });
    const body = await (await handleParse(post({ text: "x", lang: "en", today: TODAY }))).json();
    expect(body.entries[0]).toMatchObject({ date: TODAY, grossInr: 0, fuelInr: 200000 });
  });

  it("never sends phone, Aadhaar or account numbers to the model", async () => {
    await handleParse(
      post({ text: "aaj 1850 mile. mera phone 9876543210 aadhaar 2345 6789 0123", lang: "hi", today: TODAY }),
    );
    const sent = JSON.stringify(llm.generateJSON.mock.calls[0][0]);
    expect(sent).not.toMatch(/9876543210|2345 6789 0123/);
    expect(sent).toContain("[PHONE]");
  });

  it("attaches a screenshot as an image part", async () => {
    await handleParse(post({ image: { mimeType: "image/jpeg", data: "QUJD" }, lang: "hi", today: TODAY }));
    const parts = llm.generateJSON.mock.calls[0][0][0].parts;
    expect(
      parts.some(
        (p: { inlineData?: { mimeType: string; data: string } }) =>
          p.inlineData?.mimeType === "image/jpeg" && p.inlineData?.data === "QUJD",
      ),
    ).toBe(true);
    expect(parts[0].text).toMatch(/screenshot/i);
  });

  it("asks the model for deterministic output", async () => {
    await handleParse(post({ text: "x", lang: "hi", today: TODAY }));
    expect(llm.generateJSON.mock.calls[0][2]).toMatchObject({ temperature: 0 });
  });

  it("returns 503 no_key when there is no API key", async () => {
    llm.keyPresent = false;
    const res = await handleParse(post({ text: "x", lang: "hi", today: TODAY }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "no_key" });
    expect(llm.generateJSON).not.toHaveBeenCalled();
  });

  it("rejects bad input with 400 before any model call", async () => {
    for (const body of ["not json", {}, { lang: "hi", today: TODAY }, { text: "x", lang: "hi", today: "bad" }]) {
      const res = await handleParse(post(body));
      expect(res.status).toBe(400);
    }
    expect(llm.generateJSON).not.toHaveBeenCalled();
  });

  it("maps a provider rate limit to 429 and other failures to 502 without leaking details", async () => {
    llm.generateJSON.mockRejectedValueOnce(new LlmError("quota", 429));
    expect((await handleParse(post({ text: "x", lang: "hi", today: TODAY }))).status).toBe(429);

    llm.generateJSON.mockRejectedValueOnce(new Error("secret provider detail key=abc"));
    const res = await handleParse(post({ text: "x", lang: "hi", today: TODAY }));
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toMatch(/secret|abc/);
  });

  it("rate limits per client", async () => {
    let last = 200;
    for (let i = 0; i < 25; i++)
      last = (await handleParse(post({ text: "x", lang: "hi", today: TODAY }, "9.9.9.9"))).status;
    expect(last).toBe(429);
    // A different client is unaffected.
    expect((await handleParse(post({ text: "x", lang: "hi", today: TODAY }, "8.8.8.8"))).status).toBe(200);
  });

  it("reports the model's question when nothing could be read", async () => {
    llm.generateJSON.mockResolvedValue({ entries: [], question: "Kitne rupaye mile?" });
    const body = await (await handleParse(post({ text: "hello", lang: "hi", today: TODAY }))).json();
    expect(body).toMatchObject({ entries: [], question: "Kitne rupaye mile?" });
  });
});

describe("handleInsight", () => {
  const body = {
    lang: "hi",
    today: TODAY,
    summary: { net: 8400, gross: 11000, deductions: 900, fuel: 1700, days: 6, netPerHour: 142, netChangePct: -12 },
    flags: [],
  };

  it("returns the explanation text", async () => {
    const res = await handleInsight(post(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "Is hafte aapne Rs 8,400 bachaye." });
  });

  it("sends only aggregates to the model", async () => {
    await handleInsight(post({ ...body, notes: "secret note 9876543210", extra: "x" }));
    const sent = JSON.stringify(llm.generateText.mock.calls[0]);
    expect(sent).not.toMatch(/secret note|9876543210/);
  });

  it("returns 502 for an empty model reply instead of an empty explanation", async () => {
    llm.generateText.mockResolvedValue("   ");
    expect((await handleInsight(post(body))).status).toBe(502);
  });

  it("handles no key and bad input", async () => {
    llm.keyPresent = false;
    expect((await handleInsight(post(body))).status).toBe(503);
    llm.keyPresent = true;
    expect((await handleInsight(post({ ...body, summary: { net: "lots" } }))).status).toBe(400);
  });
});
