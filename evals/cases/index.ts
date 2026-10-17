import { EARNINGS_CASES } from "./earnings";
import { GRIEVANCE_CASES } from "./grievance";
import { REDTEAM_CASES } from "./redteam";
import { RIGHTS_CASES } from "./rights";
import { SAFETY_CASES } from "./safety";
import type { EvalCase } from "./types";

export type { ChatCase, EvalCase, GrievanceCase, ParseCase } from "./types";

export const CASES: EvalCase[] = [
  ...RIGHTS_CASES,
  ...SAFETY_CASES,
  ...REDTEAM_CASES,
  ...EARNINGS_CASES,
  ...GRIEVANCE_CASES,
];
