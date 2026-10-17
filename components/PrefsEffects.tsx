"use client";

import { useEffect } from "react";
import { usePref } from "@/lib/prefs/store";

/** Applies saved display preferences to the page. Renders nothing. */
export function PrefsEffects() {
  const largeText = usePref("largeText");
  useEffect(() => {
    document.documentElement.dataset.text = largeText ? "large" : "normal";
  }, [largeText]);
  return null;
}
