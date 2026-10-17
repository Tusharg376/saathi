import { describe, expect, it } from "vitest";
import { failureOf, postJson, type FetchLike } from "./postJson";

const reply =
  (status: number, body: unknown): FetchLike =>
  async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe("postJson", () => {
  it("sends JSON and returns the parsed body", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const fetchFn: FetchLike = async (url, init) => {
      seen = { url, init };
      return { ok: true, status: 200, json: async () => ({ hello: "world" }) };
    };
    const r = await postJson<{ hello: string }>("/api/x", { a: 1 }, fetchFn);
    expect(seen?.url).toBe("/api/x");
    expect(seen?.init.method).toBe("POST");
    expect((seen?.init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(seen?.init.body as string)).toEqual({ a: 1 });
    expect(r).toEqual({ offline: false, ok: true, status: 200, data: { hello: "world" } });
  });

  it("reports a dead network as offline instead of throwing", async () => {
    const down: FetchLike = async () => {
      throw new TypeError("Failed to fetch");
    };
    expect(await postJson("/api/x", {}, down)).toEqual({ offline: true });
  });

  it("survives a response whose body is not JSON", async () => {
    const bad: FetchLike = async () => ({ ok: false, status: 502, json: async () => Promise.reject(new Error("bad")) });
    expect(await postJson("/api/x", {}, bad)).toMatchObject({ offline: false, ok: false, status: 502, data: {} });
  });
});

describe("failureOf", () => {
  const kind = async (status: number, body: unknown) => failureOf(await postJson("/x", {}, reply(status, body)));

  it("is null on success", async () => {
    expect(await kind(200, { ok: true })).toBeNull();
  });
  it("tells offline, no key, rate limited and other failures apart", async () => {
    expect(failureOf(await postJson("/x", {}, async () => { throw new Error("x"); }))).toBe("offline");
    expect(await kind(503, { error: "no_key" })).toBe("no_key");
    expect(await kind(429, { error: "rate_limited" })).toBe("rate_limited");
    expect(await kind(502, { error: "llm_error" })).toBe("failed");
    expect(await kind(500, {})).toBe("failed");
  });
  it("trusts the error code even when the status is unusual", async () => {
    expect(await kind(200, { error: "rate_limited" })).toBe("rate_limited");
    expect(await kind(200, { error: "no_key" })).toBe("no_key");
  });
});
