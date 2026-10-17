import { beforeEach, describe, expect, it } from "vitest";
import { _resetRateLimit, clientKey, rateLimit } from "./ratelimit";

beforeEach(() => _resetRateLimit());

describe("rateLimit", () => {
  it("allows up to the limit then blocks", () => {
    for (let i = 0; i < 3; i++) expect(rateLimit("ip", 3, 60_000, 1000 + i).ok).toBe(true);
    const blocked = rateLimit("ip", 3, 60_000, 1010);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("tells the caller how long to wait", () => {
    rateLimit("ip", 1, 60_000, 0);
    expect(rateLimit("ip", 1, 60_000, 10_000).retryAfterSec).toBe(50);
  });

  it("frees capacity once the window has passed", () => {
    rateLimit("ip", 1, 60_000, 0);
    expect(rateLimit("ip", 1, 60_000, 30_000).ok).toBe(false);
    expect(rateLimit("ip", 1, 60_000, 60_001).ok).toBe(true);
  });

  it("limits each client separately", () => {
    rateLimit("a", 1, 60_000, 0);
    expect(rateLimit("a", 1, 60_000, 1).ok).toBe(false);
    expect(rateLimit("b", 1, 60_000, 1).ok).toBe(true);
  });
});

describe("clientKey", () => {
  it("uses the first forwarded address", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
  });
  it("falls back to x-real-ip then a local key", () => {
    expect(clientKey(new Headers({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientKey(new Headers())).toBe("local");
  });
});
