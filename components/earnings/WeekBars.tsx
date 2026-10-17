"use client";

import { inr, shortDate } from "@/lib/earnings/format";
import { parseISODate } from "@/lib/earnings/dates";
import type { DayTotal } from "@/lib/earnings/math";

/**
 * Seven bars, one per day. Today is yellow (the plate colour); other days are tarmac.
 * Loss days show a short red stub. Every bar has a text label for screen readers.
 */
export function WeekBars({ days, locale }: { days: DayTotal[]; locale: string }) {
  const max = Math.max(1, ...days.map((d) => d.net));
  const letter = new Intl.DateTimeFormat(locale, { weekday: "narrow" });

  return (
    <ul className="flex h-28 items-end gap-2" aria-label="Net per day">
      {days.map((d, i) => {
        const isToday = i === days.length - 1;
        const pct = d.net > 0 ? Math.max(6, (d.net / max) * 100) : 0;
        return (
          <li
            key={d.date}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1"
            aria-label={`${shortDate(d.date, locale)}: ${inr(d.net)}`}
          >
            <div className="flex w-full flex-1 items-end">
              {d.net < 0 ? (
                <div className="h-1.5 w-full rounded-sm bg-signal" />
              ) : pct === 0 ? (
                <div className="h-0.5 w-full rounded-sm bg-line" />
              ) : (
                <div
                  className={`w-full rounded-t-md border-2 border-tarmac ${isToday ? "bg-plate" : "bg-tarmac"}`}
                  style={{ height: `${pct}%` }}
                />
              )}
            </div>
            <span aria-hidden className={`text-xs ${isToday ? "font-extrabold" : "text-ink-soft"}`}>
              {letter.format(parseISODate(d.date))}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
