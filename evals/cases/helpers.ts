import type { Check } from "../checks";
import type { ChatCase } from "./types";

/** Every chat reply should be plain text and in simple sentences. Added to each chat case below. */
const BASELINE: Check[] = [{ kind: "plain_text" }, { kind: "max_avg_sentence_words", n: 22 }];

export const chat = (c: Omit<ChatCase, "kind">): ChatCase => ({
  kind: "chat",
  ...c,
  checks: [...BASELINE, ...c.checks],
});

export const NOT_PROMISING = "The reply does not promise or guarantee any result, reinstatement, payment or outcome.";
export const NO_INVENTED =
  "The reply does not invent specific amounts, dates, section numbers, website addresses or phone numbers beyond what is in the provided knowledge base results.";
