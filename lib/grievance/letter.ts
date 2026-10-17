import { getEntry } from "../kb";
import type { KbEntry } from "../kb";

export const ISSUES = [
  "deactivation",
  "short_payment",
  "penalty",
  "incentive",
  "accident_claim",
  "harassment",
  "wage_theft",
  "challan",
] as const;
export type Issue = (typeof ISSUES)[number];

export const issueKbId = (i: Issue) => `grievance.${i}`;
export const issueEntry = (i: Issue): KbEntry | undefined => getEntry(issueKbId(i));

export interface Details {
  /** Platform, employer or contractor the complaint is against. */
  party?: string;
  dates?: string;
  amountInr?: number;
  ids?: string;
  city?: string;
}

/** The worker's own contact details. They stay on the device and are never sent to the model. */
export interface Contact {
  name?: string;
  phone?: string;
  city?: string;
  /** Pre-formatted date, e.g. "17 October 2026". */
  date?: string;
}

/* ------------------------------------------------------------------ */
/* Placeholders: the model writes {{name}}, the device fills them in.   */
/* ------------------------------------------------------------------ */

const FALLBACK: Record<keyof Contact, string> = {
  name: "[YOUR NAME]",
  phone: "[YOUR PHONE]",
  city: "[YOUR CITY]",
  date: "[DATE]",
};

export function fillPlaceholders(text: string, c: Contact): string {
  return text.replace(/\{\{\s*(name|phone|city|date)\s*\}\}/gi, (_, key: string) => {
    const k = key.toLowerCase() as keyof Contact;
    return c[k]?.trim() || FALLBACK[k];
  });
}

/** Placeholders still showing in the letter. The worker must fix these before sending. */
export function unfilled(text: string): string[] {
  return [...new Set(text.match(/\[(?:YOUR [A-Z ]+|DATE|ADD:[^\]]*)\]/g) ?? [])];
}

/**
 * Redaction tokens from the app ([PHONE], [AADHAAR]...) must never end up in a letter.
 * A phone number becomes the {{phone}} placeholder; other IDs become an explicit gap
 * the worker can choose to fill, because a complaint rarely needs an Aadhaar number.
 */
export function repairRedactionTokens(text: string): string {
  return text
    .replace(/\[PHONE\]/g, "{{phone}}")
    .replace(/\[(?:AADHAAR|PAN|ACCOUNT|UPI|IFSC|EMAIL)\]/g, "[ADD: number, only if the office asks for it]");
}

/* ------------------------------------------------------------------ */
/* Deterministic fallback letter: no AI, no network                      */
/* ------------------------------------------------------------------ */

const ASK: Record<Issue, string> = {
  deactivation:
    "Please tell me in writing the exact reason my account was deactivated, give me a fair chance to appeal, and restore my account if the action was taken in error.",
  short_payment: "Please pay the amount that is due to me and send me a written breakdown that explains the difference.",
  penalty:
    "Please share the rule and the proof used to apply this penalty, review it, and refund the amount if it was applied wrongly.",
  incentive: "Please pay the incentive I earned, or explain in writing why it does not apply to me.",
  accident_claim:
    "Please tell me in writing how to claim the accident cover that applies to me and by what date, and process my claim.",
  harassment:
    "Please look into this incident, take steps to keep me safe, and tell me the outcome in writing.",
  wage_theft: "Please pay the wages that are due to me for the days I worked.",
  challan: "Please review this challan, because I believe it was issued in error, and cancel it if that is the case.",
};

const ADDRESSEE: Record<Issue, (party?: string) => string> = {
  deactivation: (p) => `The Grievance Officer${p ? `, ${p}` : ""}`,
  short_payment: (p) => `The Grievance Officer${p ? `, ${p}` : ""}`,
  penalty: (p) => `The Grievance Officer${p ? `, ${p}` : ""}`,
  incentive: (p) => `The Grievance Officer${p ? `, ${p}` : ""}`,
  accident_claim: (p) => `The Grievance Officer${p ? `, ${p}` : ""}`,
  harassment: (p) => `The Safety Team and Grievance Officer${p ? `, ${p}` : ""}`,
  wage_theft: (p) => `${p ? `${p}, with a copy to ` : ""}The Labour Commissioner, District Labour Office`,
  challan: () => "The Officer in charge of traffic challans",
};

const SUBJECT: Record<Issue, string> = {
  deactivation: "Complaint: my account was deactivated, request for reason and review",
  short_payment: "Complaint: payment is short or missing",
  penalty: "Complaint: wrongful penalty or deduction, request for review",
  incentive: "Complaint: incentive earned but not paid",
  accident_claim: "Request: accident cover claim",
  harassment: "Complaint: harassment or threat, request for action",
  wage_theft: "Complaint: wages not paid",
  challan: "Request: review of a traffic challan",
};

export function templateSubject(issue: Issue): string {
  return SUBJECT[issue];
}

/**
 * A plain, polite, factual letter built without any AI. The worker's own description is
 * included as they wrote it, so nothing is invented or changed.
 */
export function buildTemplateLetter(issue: Issue, description: string, d: Details = {}): string {
  const facts: string[] = [];
  if (d.party) facts.push(`Against: ${d.party}`);
  if (d.dates) facts.push(`Date(s): ${d.dates}`);
  if (d.amountInr) facts.push(`Amount involved: Rs ${d.amountInr.toLocaleString("en-IN")}`);
  if (d.ids) facts.push(`Reference or trip numbers: ${d.ids}`);

  const attach = issueEntry(issue)?.documents_needed ?? [];

  return [
    `Date: {{date}}`,
    ``,
    `To,`,
    ADDRESSEE[issue](d.party),
    ``,
    `Subject: ${SUBJECT[issue]}`,
    ``,
    `Respected Sir or Madam,`,
    ``,
    `I am writing to you about a problem I am facing.`,
    ``,
    description.trim(),
    ``,
    ...(facts.length ? [...facts, ``] : []),
    ASK[issue],
    ``,
    ...(attach.length ? [`I am attaching or can provide:`, ...attach.map((a) => `- ${a}`), ``] : []),
    `I request you to reply within 15 days. Please contact me if you need any more information.`,
    ``,
    `Thank you.`,
    ``,
    `Yours faithfully,`,
    `{{name}}`,
    `Phone: {{phone}}`,
    `{{city}}`,
  ].join("\n");
}
