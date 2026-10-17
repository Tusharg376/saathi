import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetRateLimit, rateLimit } from "./ratelimit";

beforeEach(() => _resetRateLimit());
afterEach(() => vi.unstubAllEnvs());

describe("rateLimit: keeping memory in check", () => {
  it("forgets visitors who stopped long ago, but never one who is still being limited", () => {
    // 5,000 one-off visitors came and went a long time ago...
    for (let i = 0; i < 5000; i++) rateLimit(`visitor-${i}`, 1, 60_000, 0);
    // ...then a busy client arrives, which triggers the cleanup.
    expect(rateLimit("busy", 1, 60_000, 100_000).ok).toBe(true);

    // Cleanup must not have wiped the busy client's record, or they could skip the limit.
    expect(rateLimit("busy", 1, 60_000, 100_001).ok).toBe(false);
    // An old visitor starts fresh, as they should after a quiet minute.
    expect(rateLimit("visitor-7", 1, 60_000, 100_002).ok).toBe(true);
  });
});

describe("rateLimit: the default allowance", () => {
  it("allows 20 requests a minute when nothing is configured", () => {
    for (let i = 0; i < 20; i++) expect(rateLimit("a", undefined, 60_000, 1000 + i).ok).toBe(true);
    expect(rateLimit("a", undefined, 60_000, 1100).ok).toBe(false);
  });

  it("can be tightened from the environment without a code change", () => {
    vi.stubEnv("RATE_LIMIT_PER_MINUTE", "2");
    expect(rateLimit("b", undefined, 60_000, 1000).ok).toBe(true);
    expect(rateLimit("b", undefined, 60_000, 1001).ok).toBe(true);
    expect(rateLimit("b", undefined, 60_000, 1002).ok).toBe(false);
  });

  it("ignores a setting that is not a number, rather than blocking everyone", () => {
    vi.stubEnv("RATE_LIMIT_PER_MINUTE", "plenty");
    expect(rateLimit("c", undefined, 60_000, 1000).ok).toBe(true);
  });
});
