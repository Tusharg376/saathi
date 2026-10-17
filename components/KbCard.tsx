"use client";

import { CheckCircle2, ExternalLink, Hourglass, MapPin, Megaphone, MessageCircle, PenLine, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { Plate } from "./Plate";
import { useI18n } from "@/lib/i18n/provider";
import type { LangCode, MessageKey } from "@/lib/i18n/messages";
import { ISSUES, type Issue } from "@/lib/grievance/letter";
import type { KbEntry, KbStatus } from "@/lib/kb";
import { localizeEntry } from "@/lib/kb/localize";
import { isOfficialHost } from "@/lib/safety/links";
import { useHandoffNav } from "@/lib/useHandoffNav";

const STATUS: Record<KbStatus, { key: MessageKey; Icon: typeof Hourglass; cls: string }> = {
  live: { key: "status.live", Icon: CheckCircle2, cls: "bg-highway text-white border-highway" },
  rolling_out: { key: "status.rolling_out", Icon: Hourglass, cls: "bg-plate text-tarmac border-tarmac" },
  announced: { key: "status.announced", Icon: Megaphone, cls: "bg-paper text-tarmac border-tarmac border-dashed" },
  state_specific: { key: "status.state_specific", Icon: MapPin, cls: "bg-strip text-white border-strip" },
};

export function StatusBadge({ status }: { status: KbStatus }) {
  const { t } = useI18n();
  const { key, Icon, cls } = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-0.5 text-sm font-bold ${cls}`}>
      <Icon size={15} aria-hidden />
      {t(key)}
    </span>
  );
}

/**
 * Text that was not translated stays English. Marking it lang="en" makes a screen reader pronounce
 * it as English instead of reading English words with a Hindi or Tamil voice.
 */
const contentLang = (ui: LangCode, shown: unknown, english: unknown): "en" | undefined =>
  ui !== "en" && shown === english ? "en" : undefined;

interface SectionProps {
  title: string;
  items?: string[];
  ordered?: boolean;
  lang?: "en";
  /** One level below the card's own title, so headings never skip a level. */
  Heading: "h3" | "h4";
}

function Section({ title, items, ordered, lang, Heading }: SectionProps) {
  if (!items?.length) return null;
  const List = ordered ? "ol" : "ul";
  return (
    <section className="mt-3">
      <Heading className="font-extrabold">{title}</Heading>
      <List lang={lang} className={`mt-1 space-y-1 pl-5 ${ordered ? "list-decimal" : "list-disc"} marker:text-tarmac`}>
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </List>
    </section>
  );
}

/** The complaint type this card describes, if it is one of the complaint routes. */
const issueOf = (entry: KbEntry): Issue | undefined => {
  const id = entry.id.replace(/^grievance\./, "");
  return entry.category === "grievance" ? ISSUES.find((i) => i === id) : undefined;
};

/** Hands the worker on: ask the chat about this card, or start the matching complaint. */
function CardActions({ entry }: { entry: KbEntry }) {
  const { t } = useI18n();
  const goWith = useHandoffNav();
  const issue = issueOf(entry);
  const btn =
    "flex min-h-11 items-center gap-1.5 rounded-full border-2 border-tarmac bg-paper px-3 text-sm font-bold active:bg-line";

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        className={btn}
        onClick={() => goWith("chat", { prompt: t("card.ask_prompt", { title: entry.title }) })}
      >
        <MessageCircle size={16} aria-hidden />
        {t("card.ask")}
      </button>
      {issue && (
        <button type="button" className={btn} onClick={() => goWith("complaint", { issue })}>
          <PenLine size={16} aria-hidden />
          {t("card.complain")}
        </button>
      )}
    </div>
  );
}

interface Props {
  entry: KbEntry;
  action?: ReactNode;
  /** Heading level for the title, so headings stay in order on the page that shows the card. */
  headingLevel?: "h2" | "h3";
  /** Show the "ask Saathi" / "write this complaint" buttons. Off where the card already sits inside the chat. */
  showActions?: boolean;
}

export function KbCard({ entry: english, action, headingLevel = "h3", showActions = true }: Props) {
  const { t, lang } = useI18n();
  // The worker's language when a validated translation exists; English otherwise.
  const entry = localizeEntry(english, lang);
  const Heading = headingLevel;
  const SectionHeading = headingLevel === "h2" ? "h3" : "h4";
  const host = new URL(entry.source_url).host.replace(/^www\./, "");
  const l = (field: keyof KbEntry) => contentLang(lang, entry[field], english[field]);

  return (
    <article className="rounded-2xl border-2 border-tarmac bg-paper p-4">
      <StatusBadge status={entry.status} />
      <Heading lang={l("title")} className="mt-2 text-xl font-extrabold leading-snug">
        {entry.title}
      </Heading>
      <p lang={l("summary")} className="mt-1">
        {entry.summary}
      </p>

      {entry.status_note && (
        <p lang={l("status_note")} className="mt-3 rounded-xl border-2 border-dashed border-tarmac bg-dust p-3 text-sm">
          <strong lang={lang}>{t("rights.note")}: </strong>
          {entry.status_note}
        </p>
      )}

      <details className="group mt-3">
        <summary className="min-h-11 cursor-pointer select-none rounded-lg py-2 font-extrabold underline decoration-plate decoration-4 underline-offset-4">
          {t("rights.eligibility")} · {t("rights.how")}
        </summary>
        <Section
          title={t("rights.eligibility")}
          items={entry.eligibility}
          lang={l("eligibility")}
          Heading={SectionHeading}
        />
        <Section title={t("rights.benefits")} items={entry.benefits} lang={l("benefits")} Heading={SectionHeading} />
        <Section
          title={t("rights.how")}
          items={entry.how_to_apply}
          ordered
          lang={l("how_to_apply")}
          Heading={SectionHeading}
        />
        <Section
          title={t("rights.docs")}
          items={entry.documents_needed}
          lang={l("documents_needed")}
          Heading={SectionHeading}
        />
        <Section title={t("rights.steps")} items={entry.steps} ordered lang={l("steps")} Heading={SectionHeading} />
      </details>

      {showActions && <CardActions entry={entry} />}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t-2 border-line pt-3">
        {entry.helpline ? (
          // No aria-label: the visible text (label and number) is the accessible name.
          <a href={`tel:${entry.helpline}`} className="flex items-center gap-2">
            <Plate value={entry.helpline} label={t("rights.helpline")} size="sm" />
            <Phone size={20} aria-hidden />
          </a>
        ) : (
          <span />
        )}
        {action}
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
        <a
          href={entry.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1 font-bold text-strip underline"
        >
          {t(isOfficialHost(host) ? "rights.source" : "rights.source_other")}: {host}
          <ExternalLink size={14} aria-hidden />
        </a>
        <span>{entry.last_verified ? t("rights.checked", { date: entry.last_verified }) : t("rights.unchecked")}</span>
      </p>
    </article>
  );
}
