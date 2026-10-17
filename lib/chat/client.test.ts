import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatEvent, ChatRequest } from "../agent/events";
import { isChatEvent, streamChat } from "./client";

const request = { messages: [{ role: "user", text: "hi" }], lang: "en" } as ChatRequest;

/** A fetch that streams the given chunks, the way /api/chat does. */
function streaming(chunks: string[]) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return vi.fn().mockResolvedValue({ body });
}

const line = (e: unknown) => JSON.stringify(e) + "\n";

async function collect(chunks: string[]): Promise<ChatEvent[]> {
  vi.stubGlobal("fetch", streaming(chunks));
  const events: ChatEvent[] = [];
  await streamChat(request, (e) => events.push(e));
  return events;
}

afterEach(() => vi.unstubAllGlobals());

describe("isChatEvent", () => {
  it("accepts every event type the server sends, including proposed actions", () => {
    const types = ["emergency", "notice", "tool", "text", "action", "sources", "fallback", "error", "done"];
    for (const type of types) expect(isChatEvent({ type })).toBe(true);
  });
  it("rejects anything else", () => {
    for (const x of [null, undefined, "text", 3, {}, { type: "nope" }, { type: 5 }, { type: "toString" }]) {
      expect(isChatEvent(x)).toBe(false);
    }
  });
});

describe("streamChat", () => {
  it("delivers a proposed action to the screen (it must not be filtered out)", async () => {
    const action = { kind: "start_complaint", issue: "penalty", summary: "Wrongly fined." };
    const events = await collect([line({ type: "action", action }), line({ type: "done" })]);
    expect(events).toEqual([{ type: "action", action }, { type: "done" }]);
  });

  it("reassembles events split across network chunks, even in the middle of a character", async () => {
    const full = line({ type: "text", text: "नमस्ते" });
    const bytes = new TextEncoder().encode(full);
    const cut = bytes.indexOf(0xa4) + 1; // inside a multi-byte Devanagari character
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        body: new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(bytes.slice(0, cut));
            c.enqueue(bytes.slice(cut));
            c.close();
          },
        }),
      }),
    );
    const events: ChatEvent[] = [];
    await streamChat(request, (e) => events.push(e));
    expect(events).toEqual([{ type: "text", text: "नमस्ते" }]);
  });

  it("ignores junk lines and unknown events instead of crashing", async () => {
    const events = await collect(["not json\n", line({ type: "mystery" }), line({ type: "text", text: "ok" })]);
    expect(events).toEqual([{ type: "text", text: "ok" }]);
  });

  it("rejects when the network is down, so the screen can fall back to on-device help", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(streamChat(request, () => undefined)).rejects.toThrow();
  });

  it("rejects when there is no response body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ body: null }));
    await expect(streamChat(request, () => undefined)).rejects.toThrow(/body/i);
  });

  it("posts JSON to /api/chat", async () => {
    const fetchMock = streaming([line({ type: "done" })]);
    vi.stubGlobal("fetch", fetchMock);
    await streamChat(request, () => undefined);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({ method: "POST", body: JSON.stringify(request) }),
    );
  });
});
