"use client";

import { useEffect } from "react";

/**
 * Registers the offline service worker. Production only: in development a cached shell
 * would fight hot reload and make every code change look broken.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* The app works without it; offline support is a bonus, never a requirement. */
    });
  }, []);
  return null;
}
