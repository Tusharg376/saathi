"use client";

import { MessageBubble } from "./MessageBubble";
import type { Msg } from "@/lib/chat/messages";

/**
 * The conversation. Kept in its own file so it can be loaded on demand: the welcome screen does
 * not need the knowledge base, so it should not pay for it in the first download.
 */
export default function MessageList({ messages, onRetry }: { messages: Msg[]; onRetry: () => void }) {
  return (
    <div role="log" aria-live="polite" className="space-y-4">
      {messages.map((m) => (
        <MessageBubble key={m.id} m={m} onRetry={onRetry} />
      ))}
    </div>
  );
}
