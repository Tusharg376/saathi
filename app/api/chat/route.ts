import { runChat } from "@/lib/agent/chat";
import { ChatRequest, encodeEvent, type ChatEvent } from "@/lib/agent/events";
import { clientKey, rateLimit } from "@/lib/server/ratelimit";

const NDJSON = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-store, no-transform",
  "X-Accel-Buffering": "no", // stop proxies buffering the stream
};

function oneShot(event: ChatEvent, status: number, extra: Record<string, string> = {}) {
  return new Response(encodeEvent(event) + encodeEvent({ type: "done" }), { status, headers: { ...NDJSON, ...extra } });
}

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request.headers));
  if (!limit.ok) {
    return oneShot(
      { type: "error", code: "rate_limited", message: "Too many requests. Please wait a minute." },
      429,
      { "Retry-After": String(limit.retryAfterSec) },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return oneShot({ type: "error", code: "bad_request", message: "Invalid JSON" }, 400);
  }
  const parsed = ChatRequest.safeParse(body);
  if (!parsed.success) {
    return oneShot({ type: "error", code: "bad_request", message: "Invalid request" }, 400);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of runChat(parsed.data, { signal: request.signal })) {
          controller.enqueue(encoder.encode(encodeEvent(event)));
        }
      } catch {
        controller.enqueue(encoder.encode(encodeEvent({ type: "error", code: "llm_error", message: "Something went wrong." })));
        controller.enqueue(encoder.encode(encodeEvent({ type: "done" })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: NDJSON });
}
