import { describe, expect, it } from "vitest";
import { LlmError, toLlmError } from "./errors";

const provider = (status: number | undefined, message: string) => Object.assign(new Error(message), { status });

describe("toLlmError", () => {
  it.each([400, 401, 403, 404, 413, 422])("never passes the provider's own text on for a %i", (status) => {
    const err = toLlmError(provider(status, "models/secret-internal-name is not found for API version v1beta"));
    expect(err).toBeInstanceOf(LlmError);
    expect((err as LlmError).status).toBe(status);
    expect(err.message).not.toMatch(/secret-internal-name/);
    expect(err.message).toContain(String(status));
  });

  it("maps rate limits and server errors to fixed, retry-friendly wording", () => {
    expect(toLlmError(provider(429, "quota details")).message).toMatch(/try again/i);
    expect(toLlmError(provider(503, "overloaded details")).message).toMatch(/busy/i);
  });

  it("keeps the SDK's wording only when there was no HTTP status (a dropped connection)", () => {
    expect(toLlmError(new TypeError("fetch failed")).message).toBe("fetch failed");
  });

  it("lets an abort through unchanged so callers can tell it from a failure", () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    expect(toLlmError(abort)).toBe(abort);
  });
});
