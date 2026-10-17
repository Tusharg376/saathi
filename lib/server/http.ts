import type { z } from "zod";
import { clientKey, rateLimit } from "./ratelimit";

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
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
