"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny on-device preference store (localStorage). useSyncExternalStore keeps the server
 * render and first client render identical (both "off"), then switches to the saved value,
 * with no hydration mismatch and no setState-in-effect.
 */
export type PrefKey = "largeText" | "autoRead";

const STORAGE_PREFIX = "saathi.pref.";
const CHANGE_EVENT = "saathi-prefs-change";

function read(key: PrefKey): boolean {
  try {
    return localStorage.getItem(STORAGE_PREFIX + key) === "1";
  } catch {
    return false; // private mode or blocked storage: preferences simply are not remembered
  }
}

export function setPref(key: PrefKey, value: boolean): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, value ? "1" : "0");
  } catch {
    /* not persisted; still applies for this session through the event below */
  }
  memory[key] = value;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Fallback so a toggle still works for the session when storage is blocked. */
const memory: Partial<Record<PrefKey, boolean>> = {};

function snapshot(key: PrefKey): boolean {
  return memory[key] ?? read(key);
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

export function usePref(key: PrefKey): boolean {
  return useSyncExternalStore(
    subscribe,
    () => snapshot(key),
    () => false,
  );
}
