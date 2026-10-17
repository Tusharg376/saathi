"use client";

import { Sparkles } from "lucide-react";
import { SpeakButton } from "../voice/SpeakButton";
import { useInsight } from "./useEarnings";
import { useI18n } from "@/lib/i18n/provider";
import type { Dashboard } from "@/lib/earnings/dashboard";

/** "Explain my week" in the worker's language, with a Listen button. Needs the AI; says so plainly if it is off. */
export function InsightPanel({ dashboard, today }: { dashboard: Dashboard; today: string }) {
  const { t } = useI18n();
  const { insight, explain } = useInsight(dashboard, today);

  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={() => void explain()}
        disabled={insight.status === "loading"}
        className="flex min-h-12 items-center gap-2 rounded-full border-2 border-tarmac bg-paper px-4 font-bold active:bg-line disabled:opacity-50"
      >
        <Sparkles size={18} aria-hidden />
        {t("earn.explain")}
      </button>

      {insight.status === "loading" && <div className="road-dash" role="status" aria-label={t("chat.tool.default")} />}

      {insight.status === "error" && (
        <p role="alert" className="rounded-xl border-2 border-signal bg-paper p-3 font-bold text-signal">
          {t(insight.key)}
        </p>
      )}

      {insight.status === "done" && (
        <div className="rounded-2xl border-2 border-tarmac bg-paper p-4">
          <h3 className="mb-1 text-sm font-extrabold uppercase tracking-wide text-ink-soft">{t("earn.explain_title")}</h3>
          <p className="whitespace-pre-wrap text-lg">{insight.text}</p>
          <SpeakButton text={insight.text} className="mt-3" />
        </div>
      )}
    </section>
  );
}
