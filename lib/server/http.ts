import type { z } from "zod";
import { clientKey, rateLimit } from "./ratelimit";

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

/** The biggest body any route accepts: a photo is about 4 MB of text once base64-encoded, the rest is a few KB. */
const MAX_BODY_BYTES = 4_500_000;

/**
 * A 413 Response if the request says its body is bigger than `max`, otherwise null. This runs before
 * the body is read: the field limits in the Zod schemas only apply once all of it is already in memory.
 */
export function tooLarge(request: Request, max = MAX_BODY_BYTES): Response | null {
  const declared = Number(request.headers.get("content-length"));
  return declared > max ? json({ error: "too_large" }, 413) : null;
}

/** Returns a 429 Response if this client is over its limit for `bucket`, otherwise null. */
export function tooMany(request: Request, bucket: string): Response | null {
  const r = rateLimit(`${bucket}:${clientKey(request.headers)}`);
  return r.ok ? null : json({ error: "rate_limited" }, 429, { "Retry-After": String(r.retryAfterSec) });
}

export async function readBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; res: Response }> {
  const big = tooLarge(request);
  if (big) return { ok: false, res: big };

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, res: json({ error: "bad_request", detail: "Invalid JSON" }, 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, res: json({ error: "bad_request", detail: "Invalid request" }, 400) };
  return { ok: true, data: parsed.data };
}
