"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { KbCard } from "../KbCard";
import { SpeakButton } from "../voice/SpeakButton";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/messages";
import type { Msg, UiError } from "@/lib/chat/messages";
import { getEntry } from "@/lib/kb";

const TOOL_LABEL: Record<string, MessageKey> = {
  search_kb: "chat.tool.search_kb",
  check_scheme_eligibility: "chat.tool.check_scheme_eligibility",
  lookup_helpline: "chat.tool.lookup_helpline",
};

/** The answer itself, or a "working on it" line while the first words are still coming. */
export function AnswerBubble({ m }: { m: Msg }) {
  const { t } = useI18n();
  const waiting = m.streaming && !m.text;
  if (!m.text && !waiting) return null;

  const label = t((m.tool && TOOL_LABEL[m.tool]) || "chat.tool.default");
  return (
    <div className="max-w-[92%] rounded-2xl rounded-bl-sm border-2 border-tarmac bg-paper px-4 py-3">
      {m.text && <p className="whitespace-pre-wrap break-words text-lg">{m.text}</p>}
      {m.text && !m.streaming && <SpeakButton text={m.text} className="mt-2" />}
      {waiting && (
        <div role="status" aria-label={label}>
          <p className="mb-2 text-ink-soft">{label}</p>
          <div className="road-dash" />
        </div>
      )}
    </div>
  );
}

const ERROR_TEXT: Record<Exclude<UiError, "no_key" | "bad_request">, MessageKey> = {
  offline: "chat.error.offline",
  rate_limited: "chat.error.rate_limited",
  llm_error: "chat.error.llm",
};

/** What went wrong, in the worker's language, with a retry where retrying can help. */
export function ErrorNote({ code, onRetry }: { code: UiError; onRetry: () => void }) {
  const { t } = useI18n();

  if (code === "no_key") {
    return (
      <div className="rounded-2xl border-2 border-dashed border-tarmac bg-paper p-3">
        <p className="font-extrabold">{t("chat.error.no_key.title")}</p>
        <p className="text-ink-soft">{t("chat.error.no_key.body")}</p>
        <Link href="/rights" className="mt-2 inline-flex min-h-11 items-center font-bold text-strip underline">
          {t("rights.title")}
        </Link>
      </div>
    );
  }

  const key = ERROR_TEXT[code as keyof typeof ERROR_TEXT] ?? "chat.error.llm";
  return (
    <div role="alert" className="rounded-2xl border-2 border-signal bg-paper p-3">
      <p className="text-signal">{t(key)}</p>
      {code !== "rate_limited" && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 flex min-h-11 items-center gap-2 rounded-full bg-tarmac px-4 font-bold text-white active:opacity-80"
        >
          <RotateCcw size={16} aria-hidden />
          {t("chat.retry")}
        </button>
      )}
    </div>
  );
}

const entriesOf = (ids: string[]) => ids.map(getEntry).filter((e): e is NonNullable<typeof e> => Boolean(e));

/** Knowledge cards found without the AI (no key or no connection). */
export function FallbackCards({ ids }: { ids: string[] }) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      <h3 className="font-extrabold">{t("chat.fallback.title")}</h3>
      {entriesOf(ids).map((e) => (
        <KbCard key={e.id} entry={e} showActions={false} />
      ))}
    </div>
  );
}

/** The knowledge-base entries the answer was grounded on, each expandable. */
export function SourcesList({ ids }: { ids: string[] }) {
  const { t } = useI18n();
  return (
    <div>
      <h3 className="mb-1 text-sm font-extrabold uppercase tracking-wide text-ink-soft">{t("chat.sources")}</h3>
      <ul className="space-y-2">
        {entriesOf(ids).map((e) => (
          <li key={e.id}>
            <details className="rounded-xl border-2 border-tarmac bg-paper">
              <summary className="min-h-11 cursor-pointer select-none px-3 py-2 font-bold">{e.title}</summary>
              <div className="p-2 pt-0">
                <KbCard entry={e} showActions={false} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
