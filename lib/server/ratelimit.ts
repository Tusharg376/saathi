/**
 * Small in-memory sliding-window limiter to protect the Gemini quota.
 * Per server instance only: fine for a demo or a single node. On serverless,
 * use a shared store (Upstash/Redis) before real traffic.
 */
const hits = new Map<string, number[]>();

export interface RateResult {
  ok: boolean;
  retryAfterSec: number;
}

export function rateLimit(
  key: string,
  limit = Number(process.env.RATE_LIMIT_PER_MINUTE) || 20,
  windowMs = 60_000,
  now = Date.now(),
): RateResult {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) };
  }
  recent.push(now);
  hits.set(key, recent);

  // Keep the map from growing without bound.
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  }
  return { ok: true, retryAfterSec: 0 };
}

export function clientKey(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "local";
}

/** Test helper. */
export function _resetRateLimit() {
  hits.clear();
}
