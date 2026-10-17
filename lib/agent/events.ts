import { z } from "zod";
import { isValidISODate } from "../earnings/dates";
import type { NewEntry } from "../earnings/math";
import type { Issue } from "../grievance/letter";
import { LangSchema } from "../i18n/lang-schema";
import type { EmergencyKind } from "../safety/emergency";

/**
 * Something the assistant PROPOSES the worker do next. It is only ever a suggestion: nothing
 * is saved or sent until the worker confirms on screen.
 */
export type ChatAction =
  | { kind: "log_earning"; entry: NewEntry }
  | { kind: "start_complaint"; issue: Issue; summary: string; party?: string };

/**
 * The wire protocol between /api/chat and the chat UI: newline-delimited JSON,
 * one event per line. Shared so both sides stay in sync at compile time.
 */
export type ChatEvent =
  /** Emergency detector fired. `helplines` are ids from lib/kb/data/helplines.json. */
  | { type: "emergency"; severity: "urgent" | "possible"; kinds: EmergencyKind[]; helplines: string[] }
  /** Something was changed or withheld for the worker's protection, e.g. an Aadhaar number was hidden. */
  | { type: "notice"; code: "pii_redacted"; found: string[] }
  /** The model is looking something up. Lets the UI show "Checking schemes…". */
  | { type: "tool"; name: string }
  | { type: "text"; text: string }
  /** A next step the assistant suggests, shown as a card the worker can accept or ignore. */
  | { type: "action"; action: ChatAction }
  /** KB entries the answer was grounded on (ids). The UI renders them from its bundled copy. */
  | { type: "sources"; ids: string[] }
  /** AI unavailable: these KB entries matched the question without any AI. */
  | { type: "fallback"; ids: string[] }
  | { type: "error"; code: ChatErrorCode; message: string }
  | { type: "done" };

export type ChatErrorCode = "no_key" | "rate_limited" | "bad_request" | "llm_error";

export const ChatRequest = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().max(4000),
      }),
    )
    .min(1)
    .max(24),
  lang: LangSchema,
  /** The worker's local date, so "yesterday" means the right day. */
  today: z.string().refine(isValidISODate).optional(),
  profile: z
    .object({
      age: z.number().int().min(0).max(120).optional(),
      state: z.string().max(60).optional(),
      workerType: z.enum(["delivery", "cab_driver", "construction", "domestic", "street_vendor", "other"]).optional(),
      isPlatformWorker: z.boolean().optional(),
      monthlyIncomeInr: z.number().min(0).max(10_000_000).optional(),
      isIncomeTaxPayer: z.boolean().optional(),
      inEpfoOrEsic: z.boolean().optional(),
      hasBankAccount: z.boolean().optional(),
      hasEshram: z.boolean().optional(),
    })
    .optional(),
});
export type ChatRequest = z.infer<typeof ChatRequest>;

export function encodeEvent(e: ChatEvent): string {
  return JSON.stringify(e) + "\n";
}
