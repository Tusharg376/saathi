import { failureOf, postJson, type FailureKind, type FetchLike } from "../http/postJson";
import type { DocumentRequest, NormalizedInsight } from "./insight";

export type DocumentOutcome = { kind: "insight"; insight: NormalizedInsight } | { kind: FailureKind };

/** A photo of a paper in; a plain-language explanation out. Nothing is stored. */
export async function requestDocument(req: DocumentRequest, fetchFn?: FetchLike): Promise<DocumentOutcome> {
  const result = await postJson<{ insight: NormalizedInsight }>("/api/documents", req, fetchFn);
  const failure = failureOf(result);
  if (failure) return { kind: failure };
  if (result.offline) return { kind: "offline" };
  return result.data.insight ? { kind: "insight", insight: result.data.insight } : { kind: "failed" };
}
