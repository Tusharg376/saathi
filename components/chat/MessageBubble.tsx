"use client";

import { ActionCards } from "./ActionCards";
import { AnswerBubble, ErrorNote, FallbackCards, SourcesList } from "./AssistantParts";
import { EmergencyBanner } from "../EmergencyBanner";
import { useI18n } from "@/lib/i18n/provider";
import type { Msg } from "@/lib/chat/messages";

/** A short reply (a greeting, a clarifying question) makes no claim that needs a source. */
const SUBSTANTIAL_ANSWER = 200;

/** A finished, substantial answer that is not backed by anything in the knowledge base. Said plainly, not hidden. */
const isUnsourced = (m: Msg): boolean =>
  !m.streaming && !m.error && m.text.length >= SUBSTANTIAL_ANSWER && !m.sources?.length && !m.fallback?.length;

/** One message. The assistant's is assembled from whichever parts the stream produced. */
export function MessageBubble({ m, onRetry }: { m: Msg; onRetry: () => void }) {
  const { t } = useI18n();

  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-tarmac px-4 py-2.5 text-lg text-white">
          {m.text}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {m.emergency && <EmergencyBanner severity={m.emergency.severity} helplines={m.emergency.helplines} />}
      <AnswerBubble m={m} />
      {isUnsourced(m) && <p className="text-sm text-ink-soft">{t("chat.no_sources")}</p>}
      {m.piiHidden && <p className="text-sm text-ink-soft">{t("chat.notice.pii")}</p>}
      {m.actions && m.actions.length > 0 && <ActionCards actions={m.actions} />}
      {m.error && <ErrorNote code={m.error} onRetry={onRetry} />}
      {m.fallback && m.fallback.length > 0 && <FallbackCards ids={m.fallback} />}
      {m.sources && m.sources.length > 0 && <SourcesList ids={m.sources} />}
    </div>
  );
}
