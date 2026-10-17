import { failureOf, postJson, type FetchLike } from "../http/postJson";
import type { GrievanceRequest, NormalizedDraft } from "./draft";

/**
 * Every way a drafting request can end, as one result the UI can switch on.
 * "template" means the worker still gets a usable letter, built on the device with no AI.
 */
export type DraftOutcome =
  | { kind: "questions"; questions: string[] }
  | { kind: "letter"; draft: NormalizedDraft }
  | { kind: "template"; reason: "no_key" | "failed" }
  | { kind: "rate_limited" };

export async function requestDraft(req: GrievanceRequest, fetchFn?: FetchLike): Promise<DraftOutcome> {
  const result = await postJson<{ draft: NormalizedDraft }>("/api/grievance", req, fetchFn);
  const failure = failureOf(result);

  if (failure === "rate_limited") return { kind: "rate_limited" };
  if (failure === "no_key") return { kind: "template", reason: "no_key" };
  // Offline or any other failure: the worker still gets a usable template letter.
  if (result.offline || failure) return { kind: "template", reason: "failed" };

  const draft = result.data.draft;
  if (!draft) return { kind: "template", reason: "failed" };

  if (draft.needsInfo) {
    // After the final round the model must not ask again; if it somehow does, do not loop.
    if (req.final || draft.questions.length === 0) return { kind: "template", reason: "failed" };
    return { kind: "questions", questions: draft.questions };
  }
  return draft.letter ? { kind: "letter", draft } : { kind: "template", reason: "failed" };
}
