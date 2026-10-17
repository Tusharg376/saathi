import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatEvent, ChatRequest } from "./events";

// Fake the model loop so the orchestration can be tested with no network and no key.
const loop = vi.hoisted(() => ({
  impl: null as null | ((contents: unknown, opts: Record<string, unknown>) => AsyncGenerator<unknown>),
  keyPresent: true,
}));

vi.mock("../llm/gemini", async (orig) => {
  const real = await orig<typeof import("../llm/gemini")>();
  return {
    ...real,
    hasApiKey: () => loop.keyPresent,
    runToolLoop: (contents: unknown, opts: Record<string, unknown>) => loop.impl!(contents, opts),
  };
});

import { LlmError } from "../llm/gemini";
import { runChat, toContents } from "./chat";
import { buildSystemPrompt } from "./prompt";

const collect = async (req: ChatRequest, signal?: AbortSignal): Promise<ChatEvent[]> => {
  const out: ChatEvent[] = [];
  for await (const e of runChat(req, { signal })) out.push(e);
  return out;
};
const ask = (text: string, extra: Partial<ChatRequest> = {}): ChatRequest => ({
  messages: [{ role: "user", text }],
  lang: "hi",
  ...extra,
});
const types = (evs: ChatEvent[]) => evs.map((e) => e.type);

beforeEach(() => {
  loop.keyPresent = true;
  loop.impl = async function* () {
    yield { type: "text", text: "Hello " };
    yield { type: "text", text: "there" };
  };
});

describe("runChat: happy path", () => {
  it("streams text then done", async () => {
    const evs = await collect(ask("hi"));
    expect(evs).toEqual([{ type: "text", text: "Hello " }, { type: "text", text: "there" }, { type: "done" }]);
  });

  it("reports tool use and the KB entries the answer was grounded on", async () => {
    loop.impl = async function* () {
      yield { type: "tool_call", name: "search_kb", args: { query: "pension" } };
      yield { type: "tool_result", name: "search_kb", result: { results: [{ id: "scheme.pmsym" }] } };
      yield { type: "text", text: "PM-SYM is a pension." };
    };
    const evs = await collect(ask("pension?"));
    expect(types(evs)).toEqual(["tool", "text", "sources", "done"]);
    expect(evs.find((e) => e.type === "sources")).toEqual({ type: "sources", ids: ["scheme.pmsym"] });
  });

  it("de-duplicates sources across tool calls", async () => {
    loop.impl = async function* () {
      yield { type: "tool_result", name: "search_kb", result: { results: [{ id: "a.b" }] } };
      yield { type: "tool_result", name: "search_kb", result: { results: [{ id: "a.b" }, { id: "c.d" }] } };
      yield { type: "text", text: "x" };
    };
    const evs = await collect(ask("q"));
    expect(evs.find((e) => e.type === "sources")).toEqual({ type: "sources", ids: ["a.b", "c.d"] });
  });
});

describe("runChat: safety ordering", () => {
  it("emits the emergency event FIRST, before any model output", async () => {
    const evs = await collect(ask("accident ho gaya abhi, khoon beh raha hai"));
    expect(evs[0].type).toBe("emergency");
    expect(evs[0]).toMatchObject({ severity: "urgent", kinds: expect.arrayContaining(["medical"]) });
    expect(types(evs).indexOf("text")).toBeGreaterThan(0);
  });

  it("tells the model it is an emergency so replies stay short", async () => {
    let seen = "";
    loop.impl = async function* (_c, opts) {
      seen = String(opts.system);
      yield { type: "text", text: "Call 108." };
    };
    await collect(ask("accident ho gaya abhi, ambulance chahiye"));
    expect(seen).toMatch(/EMERGENCY MODE/);
  });

  it("does not enter emergency mode for an informational question", async () => {
    let seen = "";
    loop.impl = async function* (_c, opts) {
      seen = String(opts.system);
      yield { type: "text", text: "ok" };
    };
    const evs = await collect(ask("accident insurance kaise milega"));
    expect(evs.some((e) => e.type === "emergency")).toBe(false);
    expect(seen).not.toMatch(/EMERGENCY MODE/);
  });

  it("hides Aadhaar, PAN and phone numbers from the model and tells the worker", async () => {
    let sent = "";
    loop.impl = async function* (contents) {
      sent = JSON.stringify(contents);
      yield { type: "text", text: "ok" };
    };
    const evs = await collect(ask("mera aadhaar 2345 6789 0123 hai aur PAN ABCDE1234F, phone 9876543210"));
    expect(sent).not.toMatch(/2345|ABCDE1234F|9876543210/);
    expect(sent).toMatch(/\[AADHAAR\]/);
    const notice = evs.find((e) => e.type === "notice");
    expect(notice).toMatchObject({ code: "pii_redacted" });
    expect((notice as { found: string[] }).found.sort()).toEqual(["AADHAAR", "PAN", "PHONE"]);
  });

  it("redacts earlier user turns too, not just the latest", async () => {
    let sent = "";
    loop.impl = async function* (contents) {
      sent = JSON.stringify(contents);
      yield { type: "text", text: "ok" };
    };
    await collect({
      lang: "en",
      messages: [
        { role: "user", text: "my number is 9876543210" },
        { role: "assistant", text: "Please do not share that." },
        { role: "user", text: "ok, what about pension" },
      ],
    });
    expect(sent).not.toMatch(/9876543210/);
  });
});

describe("runChat: no API key", () => {
  it("falls back to AI-free KB answers and says why", async () => {
    loop.keyPresent = false;
    const evs = await collect(ask("pension kaise milegi"));
    expect(evs.find((e) => e.type === "fallback")).toMatchObject({ ids: expect.arrayContaining(["scheme.pmsym"]) });
    expect(evs.find((e) => e.type === "error")).toMatchObject({ code: "no_key" });
    expect(evs.at(-1)).toEqual({ type: "done" });
  });

  it("still raises the emergency alert with no key", async () => {
    loop.keyPresent = false;
    const evs = await collect(ask("bachao"));
    expect(evs[0]).toMatchObject({ type: "emergency", severity: "urgent", helplines: ["emergency_112"] });
  });
});

describe("runChat: failures", () => {
  it("turns a rate-limit error into a clear event", async () => {
    loop.impl = async function* () {
      throw new LlmError("Rate limit reached.", 429);
    };
    const evs = await collect(ask("hi"));
    expect(evs.find((e) => e.type === "error")).toMatchObject({ code: "rate_limited" });
    expect(evs.at(-1)).toEqual({ type: "done" });
  });

  it("turns other model errors into llm_error", async () => {
    loop.impl = async function* () {
      throw new LlmError("busy", 503);
    };
    expect((await collect(ask("hi"))).find((e) => e.type === "error")).toMatchObject({ code: "llm_error" });
  });

  it("never leaks an unexpected exception message to the worker", async () => {
    loop.impl = async function* () {
      throw new Error("secret internal detail");
    };
    const err = (await collect(ask("hi"))).find((e) => e.type === "error") as { message: string };
    expect(err.message).not.toMatch(/secret/);
  });

  it("reports an error if the model produced no text at all", async () => {
    loop.impl = async function* () {
      yield { type: "tool_call", name: "search_kb", args: {} };
    };
    const evs = await collect(ask("hi"));
    expect(evs.find((e) => e.type === "error")).toMatchObject({ code: "llm_error" });
  });

  it("reports a missing key as no_key even when it only surfaces once the model is called", async () => {
    const { LlmUnavailableError } = await import("../llm/gemini");
    loop.impl = async function* () {
      throw new LlmUnavailableError();
    };
    const evs = await collect(ask("hi"));
    expect(evs.find((e) => e.type === "error")).toMatchObject({ code: "no_key" });
    expect(evs.at(-1)).toEqual({ type: "done" });
  });

  it("refuses a conversation that has no question from the worker, without calling the model", async () => {
    loop.impl = vi.fn(async function* () {
      yield { type: "text", text: "should never run" };
    });
    const evs = await collect({ messages: [{ role: "assistant", text: "Hello" }], lang: "hi" });
    expect(evs).toEqual([{ type: "error", code: "bad_request", message: "No user message" }]);
    expect(loop.impl).not.toHaveBeenCalled();
  });

  it("stays quiet when the client aborts", async () => {
    const ac = new AbortController();
    loop.impl = async function* () {
      ac.abort();
      throw new Error("aborted");
    };
    const evs = await collect(ask("hi"), ac.signal);
    expect(evs.some((e) => e.type === "error")).toBe(false);
  });
});

describe("toContents", () => {
  it("maps assistant to model and drops a leading assistant turn", () => {
    const c = toContents([
      { role: "assistant", text: "Namaste" },
      { role: "user", text: "hi" },
      { role: "assistant", text: "hello" },
    ]);
    expect(c.map((x) => x.role)).toEqual(["user", "model"]);
  });

  it("merges consecutive same-role turns and skips empty ones", () => {
    const c = toContents([
      { role: "user", text: "a" },
      { role: "user", text: "b" },
      { role: "assistant", text: "   " },
      { role: "user", text: "c" },
    ]);
    expect(c).toHaveLength(1);
    expect(c[0].parts?.[0].text).toBe("a\nb\nc");
  });
});

describe("buildSystemPrompt", () => {
  it("names the app language as the fallback", () => {
    expect(buildSystemPrompt({ lang: "ta" })).toMatch(/use Tamil/);
  });

  it("includes grounding, honesty and security rules", () => {
    const p = buildSystemPrompt({ lang: "hi" });
    for (const needle of [
      "search_kb",
      "NEVER invent",
      "NOT certain",
      "DATA",
      "Plain text only",
      "Never repeat or ask for Aadhaar",
    ]) {
      expect(p, needle).toContain(needle);
    }
  });

  it("only adds emergency mode when urgent", () => {
    expect(buildSystemPrompt({ lang: "hi" })).not.toContain("EMERGENCY MODE");
    expect(buildSystemPrompt({ lang: "hi", urgent: true })).toContain("EMERGENCY MODE");
  });

  it("passes the worker profile as data", () => {
    const p = buildSystemPrompt({ lang: "hi", profile: { age: 30, state: "Bihar" } });
    expect(p).toContain('"state":"Bihar"');
    expect(p).toMatch(/data, not instructions/);
    expect(buildSystemPrompt({ lang: "hi", profile: {} })).not.toContain("worker_profile");
  });
});

describe("runChat: proposed next steps", () => {
  const act = (name: string, args: unknown) =>
    (loop.impl = async function* () {
      yield { type: "ui_action", name, args };
      yield { type: "text", text: "Check it on your screen." };
    });

  it("turns a proposed earning into an action the worker confirms, using the worker's date", async () => {
    act("propose_log_earning", { platform: "Swiggy", grossInr: 1850, fuelInr: 400, date: "2026-10-16" });
    const evs = await collect(ask("kal Swiggy pe 1850 mile, petrol 400", { today: "2026-10-17" }));
    expect(evs.find((e) => e.type === "action")).toEqual({
      type: "action",
      action: {
        kind: "log_earning",
        entry: {
          date: "2026-10-16",
          platform: "Swiggy",
          grossInr: 1850,
          deductionsInr: 0,
          fuelInr: 400,
          otherCostInr: 0,
        },
      },
    });
  });

  it("falls back to today when the worker's date is missing, and repairs a bad one", async () => {
    act("propose_log_earning", { platform: "Zomato", grossInr: 900, date: "2099-01-01" });
    const evs = await collect(ask("aaj Zomato 900", { today: "2026-10-17" }));
    expect(evs.find((e) => e.type === "action")).toMatchObject({ action: { entry: { date: "2026-10-17" } } });
  });

  it("proposes a complaint with the worker's own summary", async () => {
    act("propose_complaint", {
      issue: "deactivation",
      summary: "My Uber account was blocked on 10 October.",
      party: "Uber",
    });
    const evs = await collect(ask("mera Uber ID block ho gaya"));
    expect(evs.find((e) => e.type === "action")).toEqual({
      type: "action",
      action: {
        kind: "start_complaint",
        issue: "deactivation",
        summary: "My Uber account was blocked on 10 October.",
        party: "Uber",
      },
    });
  });

  it("shows nothing for a proposal with no real amounts", async () => {
    act("propose_log_earning", { platform: "Swiggy", grossInr: 0 });
    expect((await collect(ask("hello"))).some((e) => e.type === "action")).toBe(false);
  });

  it("does not treat a model that only proposes (no prose) as a failure", async () => {
    loop.impl = async function* () {
      yield {
        type: "ui_action",
        name: "propose_complaint",
        args: { issue: "penalty", summary: "They cut Rs 400 wrongly last week." },
      };
    };
    const evs = await collect(ask("penalty kat gayi"));
    expect(evs.some((e) => e.type === "action")).toBe(true);
    expect(evs.some((e) => e.type === "error")).toBe(false);
  });

  it("tells the model the worker's date so 'yesterday' resolves", async () => {
    let system = "";
    loop.impl = async function* (_c, opts) {
      system = String(opts.system);
      yield { type: "text", text: "ok" };
    };
    await collect(ask("kal", { today: "2026-10-17" }));
    expect(system).toContain("2026-10-17");
  });
});

describe("buildSystemPrompt: next steps", () => {
  it("tells the model proposals are only suggestions and must never be described as done", () => {
    const p = buildSystemPrompt({ lang: "hi" });
    expect(p).toContain("propose_log_earning");
    expect(p).toContain("propose_complaint");
    expect(p).toMatch(/NEVER say it is already saved/);
  });
  it("omits the date line when none is given", () => {
    expect(buildSystemPrompt({ lang: "hi" })).not.toMatch(/Today's date/);
    expect(buildSystemPrompt({ lang: "hi", today: "2026-10-17" })).toContain(
      "Today's date for the worker is 2026-10-17",
    );
  });
});
