"use client";

import { SendHorizontal, Square } from "lucide-react";
import { useEffect, useRef } from "react";
import { MicButton } from "../voice/MicButton";
import { useI18n } from "@/lib/i18n/provider";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  busy: boolean;
}

/** The message box pinned above the tab bar: type, speak, send, or stop an answer in progress. */
export function ChatInput({ value, onChange, onSubmit, onStop, busy }: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLTextAreaElement>(null);

  // Grow with the content. Done in an effect, not in onChange, because dictation changes the text too.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [value]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="fixed inset-x-0 bottom-[var(--nav-h)] z-10 mx-auto flex w-full max-w-xl items-end gap-2 border-t-2 border-tarmac bg-dust px-3 py-2"
    >
      <textarea
        ref={ref}
        value={value}
        rows={1}
        maxLength={4000}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Enter sends on a keyboard; Shift+Enter makes a new line.
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder={t("chat.placeholder")}
        aria-label={t("chat.placeholder")}
        enterKeyHint="send"
        className="min-h-12 max-h-36 min-w-0 flex-1 resize-none rounded-2xl border-2 border-tarmac bg-paper px-3 py-2.5 text-lg outline-none focus:outline-3 focus:outline-strip"
      />
      {!busy && <MicButton value={value} onChange={onChange} />}
      {busy ? (
        <button
          type="button"
          onClick={onStop}
          aria-label={t("chat.stop")}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-signal text-white active:opacity-80"
        >
          <Square size={20} fill="currentColor" aria-hidden />
        </button>
      ) : (
        <button
          type="submit"
          disabled={!value.trim()}
          aria-label={t("chat.send")}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-tarmac text-white active:opacity-80 disabled:opacity-35"
        >
          <SendHorizontal size={22} aria-hidden />
        </button>
      )}
    </form>
  );
}
