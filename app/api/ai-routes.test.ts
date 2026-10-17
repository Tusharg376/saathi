import { beforeEach, describe, expect, it, vi } from "vitest";

const llm = vi.hoisted(() => ({ keyPresent: true, generateJSON: vi.fn(), generateText: vi.fn() }));

vi.mock("@/lib/llm/gemini", async (orig) => {
  const real = await orig<typeof import("@/lib/llm/gemini")>();
  return { ...real, hasApiKey: () => llm.keyPresent, generateJSON: llm.generateJSON, generateText: llm.generateText };
});

import { _resetRateLimit } from "@/lib/server/ratelimit";
import { POST as documents } from "./documents/route";
import { POST as earningsInsight } from "./earnings/insight/route";
import { POST as earningsParse } from "./earnings/parse/route";
import { POST as grievance } from "./grievance/route";

const TODAY = "2026-10-17";

/**
 * The four AI routes, each with a request the screen would really send and the answer a model would
 * give. `answer` names the field the screen reads, which also proves each route is wired to its own
 * handler and not another one's.
 */
const routes = [
  {
    path: "/api/documents",
    POST: documents,
    request: { image: { mimeType: "image/jpeg", data: "QUJDREVGR0g=" }, lang: "hi" },
    model: "json",
    modelOutput: {
      kind: "challan",
      title: "Traffic challan",
      what_is_this: "A fine for crossing a signal.",
      what_it_wants: "Pay the fine.",
      deadline: "",
      amount: "Rs 500",
      risks: [],
      next_steps: ["Check the challan on the official site."],
      bring: [],
      scam_signs: false,
      needs_human_help: false,
      confidence: "high",
      english_keywords: [],
    },
    answer: "insight",
  },
  {
    path: "/api/earnings/parse",
    POST: earningsParse,
    request: { text: "aaj Swiggy 1850", lang: "hi", today: TODAY },
    model: "json",
    modelOutput: {
      entries: [
        {
          date: TODAY,
          platform: "Swiggy",
          grossInr: 1850,
          deductionsInr: 0,
          fuelInr: 0,
          otherCostInr: 0,
          orders: 0,
          hours: 0,
          km: 0,
        },
      ],
      question: "",
    },
    answer: "entries",
  },
  {
    path: "/api/earnings/insight",
    POST: earningsInsight,
    request: {
      lang: "hi",
      today: TODAY,
      summary: { net: 8400, gross: 11000, deductions: 1200, fuel: 1400, days: 6, netPerHour: null, netChangePct: null },
      flags: [],
    },
    model: "text",
    modelOutput: "Is hafte aapne Rs 8,400 bachaye.",
    answer: "text",
  },
  {
    path: "/api/grievance",
    POST: grievance,
    request: {
      issue: "penalty",
      lang: "hi",
      letterLang: "en",
      description: "Zomato kept Rs 400 from my payout on 14 October.",
    },
    model: "json",
    modelOutput: {
      needs_info: false,
      questions: [],
      subject: "Complaint about a payout deduction",
      letter:
        "Date: {{date}}\nTo,\nThe Grievance Officer\nSubject: Deduction\nPlease review the Rs 400 deducted.\nYours faithfully,\n{{name}}",
      summary_for_worker: "The letter asks them to check the Rs 400 cut.",
      evidence: ["Screenshot of the payout"],
    },
    answer: "draft",
  },
] as const;

const post = (body: unknown) =>
  new Request("http://x/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const modelCalls = () => llm.generateJSON.mock.calls.length + llm.generateText.mock.calls.length;

beforeEach(() => {
  llm.keyPresent = true;
  llm.generateJSON.mockReset();
  llm.generateText.mockReset();
  _resetRateLimit();
});

describe.each(routes)("POST $path", (route) => {
  beforeEach(() => {
    (route.model === "json" ? llm.generateJSON : llm.generateText).mockResolvedValue(route.modelOutput);
  });

  it("answers a real request with the field the screen reads", async () => {
    const res = await route.POST(post(route.request));
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty(route.answer);
    expect(modelCalls()).toBe(1);
  });

  it("turns away a request that is not valid JSON, without asking the AI anything", async () => {
    const res = await route.POST(post("{not json"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("bad_request");
    expect(modelCalls()).toBe(0);
  });

  it("turns away a request with the wrong shape, without asking the AI anything", async () => {
    const res = await route.POST(post({ hello: "world" }));
    expect(res.status).toBe(400);
    expect(modelCalls()).toBe(0);
  });

  it("says plainly that AI is switched off when there is no key, so the screen can fall back", async () => {
    llm.keyPresent = false;
    const res = await route.POST(post(route.request));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "no_key" });
    expect(modelCalls()).toBe(0);
  });

  it("is never cached, so one worker's answer cannot be served to another", async () => {
    const res = await route.POST(post(route.request));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
