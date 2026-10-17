"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { KbCard } from "./KbCard";
import { QualifyCheck } from "./rights/QualifyCheck";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/messages";
import { allEntries, type KbCategory } from "@/lib/kb";
import { searchKb } from "@/lib/kb/search";

type Filter = "all" | Extract<KbCategory, "scheme" | "right" | "safety">;

const FILTERS: { id: Filter; key: MessageKey }[] = [
  { id: "all", key: "rights.filter.all" },
  { id: "scheme", key: "rights.filter.scheme" },
  { id: "right", key: "rights.filter.right" },
  { id: "safety", key: "rights.filter.safety" },
];

/** Cards shown at a time. The full library is long; showing it all would bloat the page and the scroll. */
const PAGE = 10;

/** Works with no AI and no network: the knowledge base is bundled and searched on the device. */
export function RightsBrowser() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);

  const entries = useMemo(() => {
    const category = filter === "all" ? undefined : filter;
    if (query.trim()) return searchKb(query, { category, limit: 30 }).map((h) => h.entry);
    return allEntries().filter((e) => !category || e.category === category);
  }, [query, filter]);

  // Any change to the search starts the list from the top again.
  const change =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setShown(PAGE);
    };

  return (
    <div className="space-y-4 px-4 py-5">
      <h1 className="text-2xl font-extrabold">{t("rights.title")}</h1>

      <QualifyCheck />

      <label className="flex min-h-14 items-center gap-2 rounded-2xl border-2 border-tarmac bg-paper px-3 focus-within:outline focus-within:outline-3 focus-within:outline-strip">
        <Search size={22} aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => change(setQuery)(e.target.value)}
          placeholder={t("rights.search")}
          aria-label={t("rights.title")}
          enterKeyHint="search"
          className="min-w-0 flex-1 bg-transparent py-3 text-lg outline-none placeholder:text-ink-soft"
        />
      </label>

      <div role="group" aria-label={t("rights.title")} className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => change(setFilter)(f.id)}
            className={`min-h-11 shrink-0 rounded-full border-2 border-tarmac px-4 font-bold ${filter === f.id ? "bg-tarmac text-white" : "bg-paper"}`}
          >
            {t(f.key)}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-tarmac p-5 text-center">{t("rights.empty")}</p>
      ) : (
        <ul className="space-y-4">
          {entries.slice(0, shown).map((e) => (
            <li key={e.id}>
              <KbCard entry={e} headingLevel="h2" />
            </li>
          ))}
        </ul>
      )}

      {entries.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="min-h-12 w-full rounded-2xl border-2 border-tarmac bg-paper font-extrabold active:bg-line"
        >
          {t("rights.more")}
        </button>
      )}

      <p className="pt-2 text-center text-sm text-ink-soft">{t("disclaimer")}</p>
    </div>
  );
}
