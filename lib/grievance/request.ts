import type { LangCode } from "../i18n/messages";
import { parseAmount } from "../earnings/format";
import type { GrievanceRequest } from "./draft";
import type { Details, Issue } from "./letter";

/** The detail boxes as typed: everything is still text. */
export interface Fields {
  party: string;
  dates: string;
  amount: string;
  ids: string;
}

export const EMPTY_FIELDS: Fields = { party: "", dates: "", amount: "", ids: "" };

/** Typed text into the structured details the letter and the model use. Blank boxes are left out. */
export function detailsFrom(fields: Fields, city?: string): Details {
  const amount = fields.amount.trim() ? parseAmount(fields.amount) : null;
  return {
    party: fields.party.trim() || undefined,
    dates: fields.dates.trim() || undefined,
    amountInr: amount && amount > 0 ? Math.round(amount) : undefined,
    ids: fields.ids.trim() || undefined,
    city: city?.trim() || undefined,
  };
}

export interface RequestInput {
  issue: Issue;
  lang: LangCode;
  letterLang: "en" | "app";
  description: string;
  fields: Fields;
  city?: string;
  /** After one round of questions the model must write the letter with what it has. */
  final: boolean;
  questions?: string[];
  answers?: string[];
}

/** The request for the drafting endpoint. Only answered questions are sent, and never contact details. */
export function buildGrievanceRequest(i: RequestInput): GrievanceRequest {
  const answers = (i.questions ?? [])
    .map((q, n) => ({ q, a: (i.answers?.[n] ?? "").trim() }))
    .filter((x) => x.a);

  return {
    issue: i.issue,
    lang: i.lang,
    letterLang: i.letterLang,
    description: i.description.trim(),
    details: detailsFrom(i.fields, i.city),
    final: i.final,
    ...(answers.length > 0 && { answers }),
  };
}

/** Matches the server's minimum, so the worker is told to add detail before a request that would be refused. */
export const MIN_DESCRIPTION_LENGTH = 10;
