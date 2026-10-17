"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { setHandoff, type HandoffMap, type HandoffTarget } from "./handoff";

/** Where each handoff lands. One table, so a screen never hard-codes another screen's address. */
export const HANDOFF_ROUTE: Record<HandoffTarget, string> = {
  complaint: "/help/complaint",
  chat: "/",
  earnings: "/earnings",
};

/** Move to another screen and bring some context along: `goWith("complaint", { issue: "penalty" })`. */
export function useHandoffNav() {
  const router = useRouter();
  return useCallback(
    <K extends HandoffTarget>(to: K, payload: HandoffMap[K]) => {
      setHandoff(to, payload);
      router.push(HANDOFF_ROUTE[to]);
    },
    [router],
  );
}
