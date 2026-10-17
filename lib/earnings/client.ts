import { failureOf, postJson, type FailureKind, type FetchLike } from "../http/postJson";
import type { InsightRequest, ParseRequest } from "./parse";
import type { NewEntry } from "./math";

export type ParseOutcome =
  | { kind: "entries"; entries: NewEntry[] }
  | { kind: "question"; question: string }
  | { kind: FailureKind };

/** Text or a screenshot in; entries to confirm out. Nothing is saved by this call. */
export async function requestParse(body: ParseRequest, fetchFn?: FetchLike): Promise<ParseOutcome> {
  const result = await postJson<{ entries: NewEntry[]; question: string }>("/api/earnings/parse", body, fetchFn);
  const failure = failureOf(result);
  if (failure) return { kind: failure };
  if (result.offline) return { kind: "offline" };

  const { entries, question } = result.data;
  if (entries?.length) return { kind: "entries", entries };
  if (question) return { kind: "question", question };
  return { kind: "failed" };
}

export type InsightOutcome = { kind: "text"; text: string } | { kind: FailureKind };

/** Aggregates in, a short explanation in the worker's language out. */
export async function requestInsight(req: InsightRequest, fetchFn?: FetchLike): Promise<InsightOutcome> {
  const result = await postJson<{ text: string }>("/api/earnings/insight", req, fetchFn);
  const failure = failureOf(result);
  if (failure) return { kind: failure };
  if (result.offline) return { kind: "offline" };
  return result.data.text ? { kind: "text", text: result.data.text } : { kind: "failed" };
}
