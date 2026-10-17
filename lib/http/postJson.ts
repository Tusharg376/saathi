/**
 * One way to call our own JSON APIs from the browser, with one way to describe what went wrong.
 * Every feature client (earnings, documents, complaints) builds on this instead of repeating
 * its own try/catch and status checks.
 */

export type FetchLike = (input: string, init: RequestInit) => Promise<Pick<Response, "ok" | "status" | "json">>;

export type ApiBody<T> = Partial<T> & { error?: string };

export type JsonResult<T> =
  | { offline: true }
  | { offline: false; ok: boolean; status: number; data: ApiBody<T> };

export async function postJson<T>(
  url: string,
  body: unknown,
  fetchFn: FetchLike = fetch as FetchLike,
): Promise<JsonResult<T>> {
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { offline: true };
  }
  const data = (await res.json().catch(() => ({}))) as ApiBody<T>;
  return { offline: false, ok: res.ok, status: res.status, data };
}

export type FailureKind = "offline" | "no_key" | "rate_limited" | "failed";

/** Why a call did not succeed, or null if it did. The one place HTTP statuses are interpreted. */
export function failureOf<T>(result: JsonResult<T>): FailureKind | null {
  if (result.offline) return "offline";
  if (result.status === 429 || result.data.error === "rate_limited") return "rate_limited";
  if (result.status === 503 || result.data.error === "no_key") return "no_key";
  return result.ok ? null : "failed";
}
