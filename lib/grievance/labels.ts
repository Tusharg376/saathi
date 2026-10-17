import type { MessageKey } from "../i18n/messages";
import type { Issue } from "./letter";

/** The screen label for each kind of complaint. A Record, so a new Issue fails to compile until it has one. */
export const ISSUE_LABEL: Record<Issue, MessageKey> = {
  deactivation: "cmp.issue.deactivation",
  short_payment: "cmp.issue.short_payment",
  penalty: "cmp.issue.penalty",
  incentive: "cmp.issue.incentive",
  accident_claim: "cmp.issue.accident_claim",
  harassment: "cmp.issue.harassment",
  wage_theft: "cmp.issue.wage_theft",
  challan: "cmp.issue.challan",
};
