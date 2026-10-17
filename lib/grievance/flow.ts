import type { LangCode, MessageKey } from "../i18n/messages";
import type { ComplaintPrefill } from "../handoff";
import { requestDraft } from "./client";
import type { FetchLike } from "../http/postJson";
import type { Contact, Issue } from "./letter";
import { EMPTY_FIELDS, MIN_DESCRIPTION_LENGTH, buildGrievanceRequest, detailsFrom, type Fields } from "./request";
import { viewFromOutcome, type LetterView } from "./view";

/** The form's starting values: blank, or filled in from another screen ("write a complaint about this"). */
export function startingPoint(prefill?: ComplaintPrefill) {
  return {
    issue: prefill?.issue ?? null,
    description: prefill?.description ?? "",
    fields: {
      ...EMPTY_FIELDS,
      party: prefill?.party ?? "",
      dates: prefill?.dates ?? "",
      amount: prefill?.amountInr ? String(prefill.amountInr) : "",
    } satisfies Fields,
  };
}

export type FlowResult =
  | { kind: "error"; key: MessageKey }
  | { kind: "questions"; questions: string[] }
  | { kind: "view"; view: LetterView };

export interface FlowInput {
  issue: Issue;
  lang: LangCode;
  letterLang: "en" | "app";
  description: string;
  fields: Fields;
  contact: Contact;
  /** The letter date, already formatted. */
  date: string;
  final: boolean;
  questions?: string[];
  answers?: string[];
}

/**
 * One drafting step, start to finish: check the description, ask for a draft, and turn whatever came
 * back into something the screen can show. Every outcome ends in a letter the worker can use,
 * a question, or a clear reason to wait.
 */
export async function runDraft(input: FlowInput, fetchFn?: FetchLike): Promise<FlowResult> {
  if (input.description.trim().length < MIN_DESCRIPTION_LENGTH) return { kind: "error", key: "cmp.desc_short" };

  const outcome = await requestDraft(
    buildGrievanceRequest({
      issue: input.issue,
      lang: input.lang,
      letterLang: input.letterLang,
      description: input.description,
      fields: input.fields,
      city: input.contact.city,
      final: input.final,
      questions: input.questions,
      answers: input.answers,
    }),
    fetchFn,
  );

  if (outcome.kind === "rate_limited") return { kind: "error", key: "cmp.err.rate" };
  if (outcome.kind === "questions") return { kind: "questions", questions: outcome.questions };

  const view = viewFromOutcome(outcome, {
    issue: input.issue,
    description: input.description,
    details: detailsFrom(input.fields, input.contact.city),
    contact: input.contact,
    date: input.date,
  });
  // viewFromOutcome only returns null for outcomes handled above.
  return view ? { kind: "view", view } : { kind: "error", key: "cmp.fail_ai" };
}
