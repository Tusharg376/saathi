"use client";

import dynamic from "next/dynamic";
import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ChatInput } from "./ChatInput";
import { useChat } from "./useChat";
import { Welcome } from "../Welcome";
import { useI18n } from "@/lib/i18n/provider";
import { useHandoff } from "@/lib/handoff";

// The conversation view pulls in the knowledge base, which the welcome screen does not need.
const MessageList = dynamic(() => import("./MessageList"));

/** The home screen: a welcome with quick questions, then the conversation. */
export function Chat() {
  const { t } = useI18n();
  const chat = useChat();
  // A question handed over from another screen ("Ask Saathi about this") starts in the box.
  const handoff = useHandoff("chat");
  const [input, setInput] = useState(handoff?.prompt ?? "");
  const end = useRef<HTMLDivElement>(null);

  // Fetch the conversation view in the background once the page is interactive.
  useEffect(() => {
    void import("./MessageList");
  }, []);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [chat.messages]);

  const ask = (text: string) => {
    void chat.send(text);
    setInput("");
  };

  return (
    <div className="flex flex-col">
      <div className="space-y-4 px-4 py-5 pb-32">
        {chat.messages.length === 0 ? (
          <Welcome onAsk={ask} />
        ) : (
          <>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={chat.reset}
                className="flex min-h-10 items-center gap-1.5 rounded-full border-2 border-tarmac bg-paper px-3 text-sm font-bold active:bg-line"
              >
                <RotateCcw size={15} aria-hidden />
                {t("chat.new")}
              </button>
            </div>
            <MessageList messages={chat.messages} onRetry={chat.retry} />
          </>
        )}
        <div ref={end} />
      </div>

      <ChatInput value={input} onChange={setInput} onSubmit={() => ask(input)} onStop={chat.stop} busy={chat.busy} />
    </div>
  );
}
