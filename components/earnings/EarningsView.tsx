"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { AddEarnings } from "./AddEarnings";
import { FlagsCard } from "./FlagsCard";
import { HistoryList } from "./HistoryList";
import { InsightPanel } from "./InsightPanel";
import { WeekCard } from "./WeekCard";
import { useEarnings } from "./useEarnings";
import { Plate } from "../Plate";
import { useI18n } from "@/lib/i18n/provider";
import { downloadCsv } from "@/lib/earnings/download";
import { inr } from "@/lib/earnings/format";
import { useHandoff } from "@/lib/handoff";
import { useHandoffNav } from "@/lib/useHandoffNav";

/** The earnings screen: today's take-home, the week, warnings with next steps, and history. */
export function EarningsView() {
  const { t } = useI18n();
  const goWith = useHandoffNav();
  const { state, dashboard, storageError } = useEarnings();
  // Entries the chat proposed open the form already filled in; the worker still checks and saves.
  const proposed = useHandoff("earnings");
  const [adding, setAdding] = useState(Boolean(proposed));

  if (storageError) {
    return (
      <div className="px-4 py-6">
        <p role="alert" className="rounded-2xl border-2 border-signal bg-paper p-4 font-bold text-signal">
          {t("earn.err.storage")}
        </p>
      </div>
    );
  }

  if (!state || !dashboard) {
    return (
      <div className="px-4 py-10" role="status" aria-label={t("earn.title")}>
        <div className="road-dash" />
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 py-5">
      <div>
        <h1 className="text-2xl font-extrabold">{t("earn.title")}</h1>
        <p className="text-sm text-ink-soft">{t("earn.private")}</p>
      </div>

      {dashboard.hasData ? (
        <div className="flex justify-center py-1">
          <Plate value={inr(dashboard.today.net)} label={t("earn.today")} size="lg" />
        </div>
      ) : (
        <p className="rounded-2xl border-2 border-dashed border-tarmac p-5 text-center text-lg">{t("earn.empty")}</p>
      )}

      <button
        type="button"
        onClick={() => setAdding(true)}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-tarmac text-lg font-extrabold text-white active:opacity-80"
      >
        <Plus size={22} aria-hidden />
        {t("earn.add")}
      </button>

      {dashboard.hasData && (
        <>
          <WeekCard dashboard={dashboard} />
          <FlagsCard flags={dashboard.flags} onComplain={(prefill) => goWith("complaint", prefill)} />
          <InsightPanel dashboard={dashboard} today={state.today} />
          <HistoryList entries={state.entries} onExport={() => downloadCsv(state.entries, state.today)} />
        </>
      )}

      <AddEarnings open={adding} onClose={() => setAdding(false)} initial={proposed?.entries} />
    </div>
  );
}
