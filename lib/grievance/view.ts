import type { MessageKey } from "../i18n/messages";
import type { DraftOutcome } from "./client";
import {
  buildTemplateLetter,
  fillPlaceholders,
  templateSubject,
  type Contact,
  type Details,
  type Issue,
} from "./letter";

/** What the result screen shows. `letter` has the worker's own details already filled in, and stays editable. */
export interface LetterView {
  letter: string;
  subject: string;
  /** Plain-language summary in the worker's language. Empty for the template letter. */
  summary: string;
  evidence: string[];
  notice?: MessageKey;
}

interface Context {
  issue: Issue;
  description: string;
  details: Details;
  contact: Contact;
  /** The letter date, already formatted. */
  date: string;
}

/**
 * The letter to show for an outcome that produced one, or null if it did not (questions, rate limit).
 * An AI draft and the offline template are both shown the same way; only the notice differs.
 */
export function viewFromOutcome(outcome: DraftOutcome, ctx: Context): LetterView | null {
  const fill = (raw: string) => fillPlaceholders(raw, { ...ctx.contact, date: ctx.date });

  if (outcome.kind === "letter") {
    const { draft } = outcome;
    return {
      letter: fill(draft.letter),
      subject: draft.subject || templateSubject(ctx.issue),
      summary: draft.summary,
      evidence: draft.evidence,
    };
  }
  if (outcome.kind === "template") {
    return {
      letter: fill(buildTemplateLetter(ctx.issue, ctx.description, ctx.details)),
      subject: templateSubject(ctx.issue),
      summary: "",
      evidence: [],
      notice: outcome.reason === "no_key" ? "cmp.no_ai" : "cmp.fail_ai",
    };
  }
  return null;
}
