/** How this week's net compares with the week before, as a plain category the UI can word and colour. */
export type Trend = { kind: "unknown" } | { kind: "same" } | { kind: "up"; pct: number } | { kind: "down"; pct: number };

/** Changes under one percent read as "about the same" rather than a misleading +0%. */
export function describeTrend(changePct: number | null): Trend {
  if (changePct === null) return { kind: "unknown" };
  if (Math.abs(changePct) < 1) return { kind: "same" };
  const pct = Math.round(Math.abs(changePct));
  return changePct > 0 ? { kind: "up", pct } : { kind: "down", pct };
}
