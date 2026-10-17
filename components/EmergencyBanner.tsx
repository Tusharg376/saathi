"use client";

import { Phone, Siren } from "lucide-react";
import { Plate } from "./Plate";
import { useI18n } from "@/lib/i18n/provider";
import { HELPLINE_LABEL } from "@/lib/i18n/messages";
import { getHelpline } from "@/lib/kb";

interface Props {
  severity: "urgent" | "possible";
  /** Helpline ids from lib/kb/data/helplines.json. */
  helplines: string[];
}

/**
 * urgent: big call buttons, impossible to miss.
 * possible: one quiet line, so a casual mention of "accident" doesn't scare anyone.
 * Rendered from on-device detection, so it works with no network and no AI.
 */
export function EmergencyBanner({ severity, helplines }: Props) {
  const { t } = useI18n();
  const items = helplines.map(getHelpline).filter((h): h is NonNullable<typeof h> => Boolean(h));

  if (severity === "possible") {
    return (
      <p
        role="status"
        className="flex items-center gap-2 rounded-xl border-2 border-dashed border-signal bg-paper px-3 py-2 text-sm font-bold text-signal"
      >
        <Siren size={16} aria-hidden />
        <a href="tel:112" className="underline">
          {t("emergency.possible")}
        </a>
      </p>
    );
  }

  return (
    <section
      role="alert"
      aria-label={t("emergency.urgent")}
      className="rounded-2xl border-4 border-signal bg-paper p-3"
    >
      <h2 className="mb-2 flex items-center gap-2 text-lg font-extrabold text-signal">
        <Siren size={22} aria-hidden />
        {t("emergency.urgent")}
      </h2>
      <ul className="space-y-2">
        {items.slice(0, 3).map((h) => (
          <li key={h.id}>
            <a
              href={`tel:${h.number}`}
              className="flex min-h-16 items-center justify-between gap-3 rounded-xl bg-signal px-3 py-2 text-white active:opacity-80"
            >
              <span className="min-w-0 text-lg font-extrabold leading-snug">
                {HELPLINE_LABEL[h.id] ? t(HELPLINE_LABEL[h.id]) : h.name}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Plate value={h.number} label={t("rights.helpline")} size="sm" />
                <Phone size={22} aria-hidden />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
