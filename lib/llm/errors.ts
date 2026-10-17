/**
 * Errors from the model layer, and what to do about them. Any error that carries an HTTP status
 * gets a fixed message, so the provider's own text (which can hold internal detail) is never passed
 * on. Only an error with no status at all, such as a dropped connection, keeps the SDK's wording.
 */

export class LlmUnavailableError extends Error {
  constructor(message = "GEMINI_API_KEY is not set") {
    super(message);
    this.name = "LlmUnavailableError";
  }
}

export class LlmError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "LlmError";
    this.status = status;
  }
}

function messageFor(status: number | undefined, fallback?: string): string {
  if (status === 429) return "Rate limit reached. Please try again in a minute.";
  if (status !== undefined && status >= 500) return "The AI service is busy. Please try again.";
  if (status !== undefined && status >= 400) {
    return `The AI service rejected the request (${status}). Check the API key and model name.`;
  }
  return fallback || "Unexpected AI error";
}

/** Turns anything the SDK throws into an LlmError. Aborts pass through so callers can tell them apart. */
export function toLlmError(err: unknown): Error {
  if (err instanceof LlmUnavailableError || err instanceof LlmError) return err;
  const e = (err ?? {}) as { status?: unknown; message?: string; name?: string };
  if (e.name === "AbortError") return err as Error;
  const status = typeof e.status === "number" ? e.status : undefined;
  return new LlmError(messageFor(status, e.message), status);
}

/** Rate limits and transient server errors are worth another try; a bad request is not. */
const RETRYABLE = new Set([429, 500, 503]);
const isRetryable = (err: unknown): boolean => RETRYABLE.has((err as { status?: number })?.status ?? 0);

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Runs `fn`, retrying transient failures with exponential backoff (0.5s, 1s). */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isRetryable(err) || i === attempts - 1) break;
      await sleep(500 * 2 ** i);
    }
  }
  throw toLlmError(last);
}
