import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatEvent } from "@/lib/agent/events";
import { _resetRateLimit } from "@/lib/server/ratelimit";
import { POST } from "./route";

const { runChat } = vi.hoisted(() => ({ runChat: vi.fn() }));
vi.mock("@/lib/agent/chat", () => ({ runChat }));

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("http://app/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

const valid = { messages: [{ role: "user", text: "hello" }], lang: "en" };

/** The events a response streamed, one per line. */
async function eventsOf(res: Response): Promise<ChatEvent[]> {
  return (await res.text())
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

async function* stream(...events: ChatEvent[]) {
  for (const e of events) yield e;
}

beforeEach(() => {
  runChat.mockReset();
  _resetRateLimit();
});

describe("POST /api/chat", () => {
  it("streams the assistant's events, one JSON object per line", async () => {
    runChat.mockReturnValue(stream({ type: "text", text: "Hi" }, { type: "done" }));
    const res = await post(valid);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/x-ndjson");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(await eventsOf(res)).toEqual([{ type: "text", text: "Hi" }, { type: "done" }]);
  });

  it("passes the validated request to the assistant", async () => {
    runChat.mockReturnValue(stream({ type: "done" }));
    await post({ ...valid, today: "2026-10-17" });
    expect(runChat.mock.calls[0][0]).toMatchObject({ lang: "en", today: "2026-10-17" });
  });

  it("rejects bad JSON with a clear error, without calling the model", async () => {
    const res = await post("{not json");
    expect(res.status).toBe(400);
    expect(await eventsOf(res)).toEqual([
      expect.objectContaining({ type: "error", code: "bad_request" }),
      { type: "done" },
    ]);
    expect(runChat).not.toHaveBeenCalled();
  });

  it("rejects a request that does not match the contract", async () => {
    for (const bad of [
      {},
      { messages: [], lang: "en" },
      { ...valid, lang: "xx" },
      { ...valid, messages: [{ role: "system", text: "x" }] },
    ]) {
      expect((await post(bad)).status).toBe(400);
    }
    expect(runChat).not.toHaveBeenCalled();
  });

  it("rejects an over-long message instead of sending it to the model", async () => {
    const res = await post({ ...valid, messages: [{ role: "user", text: "x".repeat(4001) }] });
    expect(res.status).toBe(400);
    expect(runChat).not.toHaveBeenCalled();
  });

  it("refuses a body that announces itself as huge before reading any of it, in the same event format", async () => {
    const res = await post(valid, { "content-length": "50000000" });
    expect(res.status).toBe(413);
    expect(await eventsOf(res)).toEqual([
      expect.objectContaining({ type: "error", code: "bad_request" }),
      { type: "done" },
    ]);
    expect(runChat).not.toHaveBeenCalled();
  });

  it("limits how often one client can ask, and says when to come back", async () => {
    runChat.mockImplementation(() => stream({ type: "done" }));
    let limited: Response | undefined;
    for (let i = 0; i < 100 && !limited; i++) {
      const res = await post(valid, { "x-forwarded-for": "203.0.113.9" });
      if (res.status === 429) limited = res;
    }
    expect(limited).toBeDefined();
    expect(Number(limited!.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await eventsOf(limited!)).toEqual([expect.objectContaining({ code: "rate_limited" }), { type: "done" }]);
  });

  it("does not let one client's limit block another", async () => {
    runChat.mockImplementation(() => stream({ type: "done" }));
    for (let i = 0; i < 100; i++) await post(valid, { "x-forwarded-for": "203.0.113.9" });
    expect((await post(valid, { "x-forwarded-for": "198.51.100.7" })).status).toBe(200);
  });

  it("turns a crash in the assistant into a safe error event, never a stack trace", async () => {
    runChat.mockImplementation(async function* () {
      throw new Error("boom: key=AIza-secret");
    });
    const res = await post(valid);
    const text = await res.text();
    expect(text).not.toContain("boom");
    expect(text).not.toContain("AIza-secret");
    expect(text).toContain('"code":"llm_error"');
    expect(text.trim().endsWith('{"type":"done"}')).toBe(true);
  });
});
