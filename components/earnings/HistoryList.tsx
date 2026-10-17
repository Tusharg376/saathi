"use client";

import { Download, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import { deleteEntry } from "@/lib/db";
import { shortDate, inr } from "@/lib/earnings/format";
import { netOf, type EarningEntry } from "@/lib/earnings/math";

const VISIBLE = 14;

function EntryRow({ entry }: { entry: EarningEntry }) {
  const { t, speechLang } = useI18n();
  const net = netOf(entry);
  const label = `${shortDate(entry.date, speechLang)} · ${entry.platform}`;

  const remove = () => {
    if (entry.id !== undefined && window.confirm(t("earn.delete_confirm"))) void deleteEntry(entry.id);
  };

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border-2 border-tarmac bg-paper px-3 py-2">
      <div className="min-w-0">
        <p className="truncate font-bold">{label}</p>
        <p className="text-sm text-ink-soft">
          {inr(entry.grossInr)} − {inr(entry.deductionsInr + entry.fuelInr + entry.otherCostInr)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`font-display text-xl font-extrabold [font-stretch:85%] ${net < 0 ? "text-signal" : ""}`}>
          {inr(net)}
        </span>
        <button
          type="button"
          aria-label={`${t("earn.delete")}: ${label}`}
          onClick={remove}
          className="flex size-11 items-center justify-center rounded-full active:bg-line"
        >
          <Trash2 size={18} aria-hidden />
        </button>
      </div>
    </li>
  );
}

/** The most recent entries, with delete and CSV export. */
export function HistoryList({ entries, onExport }: { entries: EarningEntry[]; onExport: () => void }) {
  const { t } = useI18n();
  return (
    <section aria-labelledby="hist-h" className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 id="hist-h" className="font-extrabold">
          {t("earn.history")}
        </h2>
        <button
          type="button"
          onClick={onExport}
          className="flex min-h-11 items-center gap-1.5 rounded-full border-2 border-tarmac bg-paper px-3 text-sm font-bold active:bg-line"
        >
          <Download size={16} aria-hidden />
          {t("earn.export")}
        </button>
      </div>
      <ul className="space-y-2">
        {entries.slice(0, VISIBLE).map((e) => (
          <EntryRow key={e.id} entry={e} />
        ))}
      </ul>
    </section>
  );
}
