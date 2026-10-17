import { LlmError, LlmUnavailableError } from "../llm/gemini";
import { LANGUAGES, type LangCode } from "../i18n/messages";
import { redactPII } from "../safety/pii";
import { json } from "./http";

/** The language's English name, for the prompt ("Hindi"). Falls back to Hindi, the app's default. */
export const languageName = (code: LangCode | string): string =>
  LANGUAGES.find((l) => l.code === code)?.english ?? "Hindi";

/**
 * Turns anything that went wrong while calling the model into a small, fixed set of answers the
 * app understands. Provider error text never reaches the worker, and is scrubbed of private numbers
 * before it is logged.
 */
export function llmFailure(scope: string, err: unknown): Response {
  if (err instanceof LlmUnavailableError) return json({ error: "no_key" }, 503);
  if (err instanceof LlmError && err.status === 429) return json({ error: "rate_limited" }, 429);
  console.error(`${scope} failure:`, redactPII(String((err as Error)?.message ?? err)).text);
  return json({ error: "llm_error" }, 502);
}
