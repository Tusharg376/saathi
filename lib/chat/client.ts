import type { ChatEvent, ChatRequest } from "../agent/events";
import { NdjsonParser } from "./ndjson";

/** Every event type the server can send. A Record, so adding a type to ChatEvent fails to compile until it is listed here. */
const EVENT_TYPES: Record<ChatEvent["type"], true> = {
  emergency: true,
  notice: true,
  tool: true,
  text: true,
  action: true,
  sources: true,
  fallback: true,
  error: true,
  done: true,
};

export function isChatEvent(x: unknown): x is ChatEvent {
  const type = typeof x === "object" && x !== null ? (x as { type?: unknown }).type : undefined;
  return typeof type === "string" && Object.hasOwn(EVENT_TYPES, type);
}

/**
 * POSTs to /api/chat and calls `onEvent` for each streamed event.
 * Rejects on network failure (offline) so the UI can fall back to on-device help.
 */
export async function streamChat(
  req: ChatRequest,
  onEvent: (e: ChatEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  // Our own errors (rate limit, bad request) come back as NDJSON events and are shown as such. Anything else
  // that is not OK (a 502 page from the host, say) has no events in it: fail so the screen falls back to
  // on-device help, instead of showing an empty answer.
  const ndjson = res.headers?.get("content-type")?.includes("ndjson") ?? false;
  if (!res.body) throw new Error("No response body");
  if (!res.ok && !ndjson) throw new Error(`Chat unavailable (${res.status})`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder(); // stream mode keeps multi-byte characters intact across chunks
  const parser = new NdjsonParser();
  const emit = (events: unknown[]) => events.filter(isChatEvent).forEach(onEvent);

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    emit(parser.push(decoder.decode(value, { stream: true })));
  }
  emit(parser.flush(decoder.decode()));
}
