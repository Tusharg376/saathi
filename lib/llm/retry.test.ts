import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LlmError, LlmUnavailableError, toLlmError, withRetry } from "./errors";

const provider = (status: number | undefined, message = "provider text") =>
  Object.assign(new Error(message), { status });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Runs `withRetry` to completion, letting the waits between attempts pass instantly. */
async function settle<T>(p: Promise<T>) {
  const outcome = p.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  await vi.runAllTimersAsync();
  return outcome;
}

describe("withRetry (a busy AI service should not fail the worker's first try)", () => {
  it("returns straight away when the first try works, with no waiting", async () => {
    const fn = vi.fn().mockResolvedValue("answer");
    expect(await withRetry(fn)).toBe("answer");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("tries again after a rate limit or a busy server, and uses the answer that finally comes", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(provider(429))
      .mockRejectedValueOnce(provider(503))
      .mockResolvedValue("answer");
    expect(await settle(withRetry(fn))).toEqual({ value: "answer" });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("waits half a second, then a second, so it does not hammer a struggling service", async () => {
    const started: number[] = [];
    const t0 = Date.now();
    const fn = vi.fn(() => {
      started.push(Date.now() - t0);
      return Promise.reject(provider(500));
    });
    await settle(withRetry(fn));
    expect(started).toEqual([0, 500, 1500]);
  });

  it("gives up after three tries with a plain error, never the provider's own words", async () => {
    const fn = vi.fn().mockRejectedValue(provider(503, "internal cluster id 77 overloaded"));
    const { error } = (await settle(withRetry(fn))) as { error: LlmError };
    expect(fn).toHaveBeenCalledTimes(3);
    expect(error).toBeInstanceOf(LlmError);
    expect(error.status).toBe(503);
    expect(error.message).not.toContain("cluster id");
  });

  it("does not retry a request the service rejected, because asking again cannot help", async () => {
    const fn = vi.fn().mockRejectedValue(provider(400, "bad key"));
    const { error } = (await settle(withRetry(fn))) as { error: LlmError };
    expect(fn).toHaveBeenCalledTimes(1);
    expect(error.status).toBe(400);
  });

  it("does not retry a missing API key", async () => {
    const fn = vi.fn().mockRejectedValue(new LlmUnavailableError());
    const { error } = (await settle(withRetry(fn))) as { error: unknown };
    expect(fn).toHaveBeenCalledTimes(1);
    expect(error).toBeInstanceOf(LlmUnavailableError);
  });

  it("honours a limit on the number of tries", async () => {
    const fn = vi.fn().mockRejectedValue(provider(429));
    await settle(withRetry(fn, 1));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("toLlmError: odd things a library can throw", () => {
  it("copes with nothing at all being thrown", () => {
    expect(toLlmError(undefined).message).toBe("Unexpected AI error");
    expect(toLlmError(null).message).toBe("Unexpected AI error");
  });

  it("copes with an error that has no message and no status", () => {
    expect(toLlmError({}).message).toBe("Unexpected AI error");
  });

  it("ignores a status that is not a number", () => {
    const err = toLlmError({ status: "503", message: "text" }) as LlmError;
    expect(err.status).toBeUndefined();
    expect(err.message).toBe("text");
  });

  it("leaves an error that was already translated alone", () => {
    const already = new LlmError("The AI service is busy. Please try again.", 503);
    expect(toLlmError(already)).toBe(already);
  });
});
