import type { WorkerProfile } from "../../lib/eligibility/engine";
import type { GrievanceRequest } from "../../lib/grievance/draft";
import type { LangCode } from "../../lib/i18n/messages";
import type { Check, LetterExpect, ParseExpect } from "../checks";

type Area = "rights" | "safety" | "earnings" | "grievance" | "redteam";

export interface ChatCase {
  kind: "chat";
  id: string;
  area: Area;
  lang: LangCode;
  message: string;
  profile?: WorkerProfile;
  checks: Check[];
}
export interface ParseCase {
  kind: "parse";
  id: string;
  area: "earnings";
  lang: LangCode;
  text: string;
  expect: ParseExpect;
}
export interface GrievanceCase {
  kind: "grievance";
  id: string;
  area: "grievance";
  request: GrievanceRequest;
  expect: LetterExpect;
}
export type EvalCase = ChatCase | ParseCase | GrievanceCase;
