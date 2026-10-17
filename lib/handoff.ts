import { useEffect, useState } from "react";
import type { NewEntry } from "./earnings/math";
import type { Issue } from "./grievance/letter";

/**
 * Carries context from one screen to the next ("write a complaint about this warning",
 * "ask Saathi about this card"). It is kept in memory only: nothing goes in the URL or in
 * storage, so a worker's details never end up in a link, history or log.
 *
 * It works because navigation inside the app is client-side, so this module survives the
 * move. After a full page reload there is nothing to hand over, and that is fine.
 */

export interface ComplaintPrefill {
  issue?: Issue;
  description?: string;
  party?: string;
  dates?: string;
  amountInr?: number;
}

export interface HandoffMap {
  complaint: ComplaintPrefill;
  chat: { prompt: string };
  earnings: { entries: NewEntry[] };
}
export type HandoffTarget = keyof HandoffMap;

/** A handoff nobody picked up within this long is stale and must not surprise a later visit. */
export const HANDOFF_TTL_MS = 30_000;

interface Pending {
  payload: unknown;
  at: number;
}
const pending = new Map<HandoffTarget, Pending>();

export function setHandoff<K extends HandoffTarget>(to: K, payload: HandoffMap[K], now = Date.now()): void {
  pending.set(to, { payload, at: now });
}

/** Reads without consuming, so React StrictMode's double render sees the same value. */
export function peekHandoff<K extends HandoffTarget>(to: K, now = Date.now()): HandoffMap[K] | undefined {
  const hit = pending.get(to);
  if (!hit) return undefined;
  if (now - hit.at > HANDOFF_TTL_MS) {
    pending.delete(to);
    return undefined;
  }
  // The only cast: setHandoff stores exactly HandoffMap[K] under key K.
  return hit.payload as HandoffMap[K];
}

export function clearHandoff(to: HandoffTarget): void {
  pending.delete(to);
}

/**
 * The handoff for this screen, captured on first render and cleared once the screen is showing.
 * Captured through state, so the screen keeps it even though the store is emptied.
 */
export function useHandoff<K extends HandoffTarget>(to: K): HandoffMap[K] | undefined {
  const [payload] = useState(() => peekHandoff(to));
  useEffect(() => {
    clearHandoff(to);
  }, [to]);
  return payload;
}
