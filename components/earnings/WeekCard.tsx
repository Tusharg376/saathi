"use client";

import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { WeekBars } from "./WeekBars";
import { useI18n } from "@/lib/i18n/provider";
import type { Dashboard } from "@/lib/earnings/dashboard";
import { inr } from "@/lib/earnings/format";
import { describeTrend } from "@/lib/earnings/trend";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="text-lg font-extrabold">{value}</dd>
    </div>
  );
}

/** The last seven days at a glance: total, trend against the week before, a bar per day, key numbers. */
export function WeekCard({ dashboard }: { dashboard: Dashboard }) {
  const { t, speechLang } = useI18n();
  const { current, netChangePct } = dashboard.week;
  const trend = describeTrend(netChangePct);

  const text =
    trend.kind === "unknown"
      ? t("earn.no_prev")
      : trend.kind === "same"
        ? t("earn.same")
        : t(trend.kind === "up" ? "earn.up" : "earn.down", { pct: trend.pct });
  const Icon = trend.kind === "up" ? TrendingUp : trend.kind === "down" ? TrendingDown : Minus;
  const color = trend.kind === "up" ? "text-highway" : trend.kind === "down" ? "text-signal" : "text-ink-soft";

  return (
    <section aria-labelledby="week-h" className="space-y-3 rounded-2xl border-2 border-tarmac bg-paper p-4">
      <div>
        <h2 id="week-h" className="text-sm font-extrabold uppercase tracking-wide text-ink-soft">
          {t("earn.week")}
        </h2>
        <p className="font-display text-4xl font-extrabold [font-stretch:85%]">{inr(current.net)}</p>
        <p className={`flex items-center gap-1.5 font-bold ${color}`}>
          <Icon size={18} aria-hidden />
          {text}
        </p>
      </div>

      <WeekBars days={dashboard.bars} locale={speechLang} />

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t-2 border-line pt-3">
        <Stat label={t("earn.stat.gross")} value={inr(current.gross)} />
        <Stat label={t("earn.stat.cuts")} value={inr(current.deductions)} />
        <Stat label={t("earn.stat.fuel")} value={inr(current.fuel)} />
        <Stat label={t("earn.stat.per_hour")} value={current.netPerHour === null ? "–" : inr(current.netPerHour)} />
      </dl>
    </section>
  );
}
