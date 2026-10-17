"use client";

import { Phone } from "lucide-react";
import { Plate } from "../Plate";
import { useI18n } from "@/lib/i18n/provider";
import type { KbEntry } from "@/lib/kb";

/** If no one replies, the next office to try, in order, from the knowledge base. */
export function EscalationLadder({ entry }: { entry: KbEntry }) {
  const { t } = useI18n();
  if (!entry.steps) return null;

  return (
    <section className="rounded-2xl border-2 border-dashed border-tarmac bg-paper p-4 print:hidden">
      <h2 className="mb-2 font-extrabold">{t("cmp.ladder")}</h2>
      <ol className="list-decimal space-y-1.5 pl-6 marker:font-extrabold">
        {entry.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      {entry.status_note && <p className="mt-3 text-sm text-ink-soft">{entry.status_note}</p>}
      {entry.helpline && (
        <a href={`tel:${entry.helpline}`} className="mt-3 inline-flex items-center gap-2">
          <Plate value={entry.helpline} label={t("rights.helpline")} size="sm" />
          <Phone size={20} aria-hidden />
        </a>
      )}
    </section>
  );
}
