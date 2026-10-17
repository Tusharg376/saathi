"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/messages";
import { watchEntries } from "@/lib/db";
import { todayISO } from "@/lib/earnings/dates";
import { requestInsight } from "@/lib/earnings/client";
import { buildDashboard, toInsightRequest, type Dashboard } from "@/lib/earnings/dashboard";
import type { EarningEntry } from "@/lib/earnings/math";
import type { FailureKind } from "@/lib/http/postJson";

export interface EarningsState {
  entries: EarningEntry[];
  today: string;
}

/** The worker's entries, kept live from on-device storage, plus everything derived from them. */
export function useEarnings() {
  const [state, setState] = useState<EarningsState | null>(null);
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    const off = watchEntries(
      (entries) => setState({ entries, today: todayISO() }),
      () => setStorageError(true),
    );
    // Roll the "today" boundary forward if the app is reopened after midnight.
    const onVisible = () => setState((s) => (s ? { ...s, today: todayISO() } : s));
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      off();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const dashboard: Dashboard | null = useMemo(
    () => (state ? buildDashboard(state.entries, state.today) : null),
    [state],
  );

  return { state, dashboard, storageError, failStorage: () => setStorageError(true) };
}

export type InsightState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; text: string }
  | { status: "error"; key: MessageKey };

const INSIGHT_ERROR: Record<FailureKind, MessageKey> = {
  no_key: "chat.error.no_key.title",
  rate_limited: "chat.error.rate_limited",
  offline: "chat.error.offline",
  failed: "chat.error.llm",
};

/** "Explain my week": sends aggregates only, never the raw entries or notes. */
export function useInsight(dashboard: Dashboard | null, today: string | undefined) {
  const { lang } = useI18n();
  const [insight, setInsight] = useState<InsightState>({ status: "idle" });

  const explain = useCallback(async () => {
    if (!dashboard || !today) return;
    setInsight({ status: "loading" });
    const outcome = await requestInsight(toInsightRequest(dashboard, today, lang));
    setInsight(
      outcome.kind === "text"
        ? { status: "done", text: outcome.text }
        : { status: "error", key: INSIGHT_ERROR[outcome.kind] },
    );
  }, [dashboard, today, lang]);

  return { insight, explain };
}
