import { afterEach, describe, expect, it, vi } from "vitest";
import { connection } from "next/server";
import { GET } from "./route";

vi.mock("next/server", () => ({ connection: vi.fn().mockResolvedValue(undefined) }));

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/health", () => {
  it("says the AI is configured when a key is set, and never shows the key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "secret-test-key-123");
    const res = await GET();
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ ok: true, ai: "configured" });
    expect(text).not.toContain("secret-test-key-123");
  });

  it("says the AI is not configured when there is no key, while the app itself is still ok", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(await (await GET()).json()).toEqual({ ok: true, ai: "not_configured" });
  });

  it("is never cached, so it always reflects the running server", async () => {
    expect((await GET()).headers.get("Cache-Control")).toBe("no-store");
  });

  it("opts out of being answered at build time, which would freeze the answer", async () => {
    await GET();
    expect(connection).toHaveBeenCalled();
  });
});
