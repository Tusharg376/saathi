/**
 * With no connection, the worker still gets something useful: the best matches from the knowledge
 * base that ships inside the app. The search code is loaded only when it is actually needed.
 */
export async function offlineAnswerIds(question: string, state?: string): Promise<string[]> {
  const { searchKb } = await import("../kb/search");
  return searchKb(question, { state, limit: 3 }).map((h) => h.entry.id);
}
