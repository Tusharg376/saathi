"use client";

import { AlertTriangle, CalendarClock, Phone, PenLine, ShieldAlert } from "lucide-react";
import { KbCard } from "../KbCard";
import { Plate } from "../Plate";
import { SpeakButton } from "../voice/SpeakButton";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/messages";
import { canComplainAbout, complaintPrefillFor } from "@/lib/documents/complaint";
import type { DocKind, NormalizedInsight } from "@/lib/documents/insight";
import { getEntry } from "@/lib/kb";
import { useHandoffNav } from "@/lib/useHandoffNav";

/** A Record, so adding a document kind fails to compile until it has a label. */
const KIND_LABEL: Record<DocKind, MessageKey> = {
  notice: "doc.kind.notice",
  challan: "doc.kind.challan",
  platform_message: "doc.kind.platform_message",
  insurance: "doc.kind.insurance",
  scheme_form: "doc.kind.scheme_form",
  bank_or_payment: "doc.kind.bank_or_payment",
  contract: "doc.kind.contract",
  id_card: "doc.kind.id_card",
  other: "doc.kind.other",
  unreadable: "doc.kind.unreadable",
};

function List({ title, items, ordered }: { title: string; items: string[]; ordered?: boolean }) {
  if (!items.length) return null;
  const Tag = ordered ? "ol" : "ul";
  return (
    <section>
      <h3 className="font-extrabold">{title}</h3>
      <Tag className={`mt-1 space-y-1 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}>
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </Tag>
    </section>
  );
}

/** A warning box with the helpline plate that matches it. */
function Warning({ tone, text, number, label, Icon }: { tone: "scam" | "help"; text: string; number: string; label: string; Icon: typeof ShieldAlert }) {
  const border = tone === "scam" ? "border-4 border-signal" : "border-2 border-dashed border-tarmac";
  return (
    <div role={tone === "scam" ? "alert" : "note"} className={`space-y-2 rounded-xl p-3 ${border}`}>
      <p className={`flex items-start gap-2 font-bold ${tone === "scam" ? "text-signal" : ""}`}>
        <Icon size={22} className="mt-0.5 shrink-0" aria-hidden />
        {text}
      </p>
      <a href={`tel:${number}`} className="inline-flex items-center gap-2">
        <Plate value={number} label={label} size="sm" />
        <Phone size={20} aria-hidden />
      </a>
    </div>
  );
}

/** The spoken version: what it is, what it wants, the deadline, and the steps. */
const spokenSummary = (i: NormalizedInsight, deadlineLabel: string): string =>
  [i.title, i.what_is_this, i.kind !== "unreadable" && i.what_it_wants, i.deadline && `${deadlineLabel}: ${i.deadline}`, ...i.next_steps]
    .filter(Boolean)
    .join(". ");

/** What a paper is, what it asks, by when, what to watch for, and what to do next. */
export function InsightCard({ insight: i }: { insight: NormalizedInsight }) {
  const { t } = useI18n();
  const goWith = useHandoffNav();
  const related = i.related.map(getEntry).filter((e): e is NonNullable<typeof e> => Boolean(e));
  const unreadable = i.kind === "unreadable";

  return (
    <div className="space-y-4">
      <article className="space-y-4 rounded-2xl border-2 border-tarmac bg-paper p-4">
        <div>
          <span className="inline-block rounded-full border-2 border-tarmac px-2.5 py-0.5 text-sm font-bold">{t(KIND_LABEL[i.kind])}</span>
          <h2 className="mt-2 text-xl font-extrabold leading-snug">{i.title}</h2>
          <SpeakButton className="mt-2" text={spokenSummary(i, t("doc.sec.deadline"))} />
        </div>

        {i.scam_signs && <Warning tone="scam" text={t("doc.scam")} number="1930" label={t("sos.plate.cyber")} Icon={ShieldAlert} />}
        {i.needs_human_help && <Warning tone="help" text={t("doc.help")} number="15100" label={t("helpline.legal")} Icon={AlertTriangle} />}
        {i.confidence === "low" && !unreadable && <p className="text-sm font-bold text-ink-soft">{t("doc.low")}</p>}

        <section>
          <h3 className="font-extrabold">{t("doc.sec.what")}</h3>
          <p className="mt-1 text-lg">{i.what_is_this}</p>
        </section>
        {!unreadable && i.what_it_wants && (
          <section>
            <h3 className="font-extrabold">{t("doc.sec.asks")}</h3>
            <p className="mt-1 text-lg">{i.what_it_wants}</p>
          </section>
        )}

        {i.deadline && (
          <p className="flex items-start gap-2 border-l-4 border-plate bg-dust p-3 font-extrabold">
            <CalendarClock size={22} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              {t("doc.sec.deadline")}: {i.deadline}
            </span>
          </p>
        )}
        {i.amount && (
          <p className="font-extrabold">
            {t("doc.sec.amount")}: {i.amount}
          </p>
        )}

        <List title={t("doc.sec.risks")} items={i.risks} />
        <List title={t("doc.sec.next")} items={i.next_steps} ordered />
        <List title={t("doc.sec.bring")} items={i.bring} />

        {canComplainAbout(i) && (
          <button
            type="button"
            onClick={() => goWith("complaint", complaintPrefillFor(i))}
            className="flex min-h-12 items-center gap-2 rounded-full border-2 border-tarmac bg-paper px-4 font-bold active:bg-line"
          >
            <PenLine size={18} aria-hidden />
            {t("doc.complain")}
          </button>
        )}
      </article>

      {related.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-extrabold">{t("doc.related")}</h3>
          {related.map((e) => (
            <KbCard key={e.id} entry={e} />
          ))}
        </section>
      )}
    </div>
  );
}
