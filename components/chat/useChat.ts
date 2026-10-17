"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { todayISO } from "@/lib/earnings/dates";
import { streamChat } from "@/lib/chat/client";
import { offlineAnswerIds } from "@/lib/chat/offline";
import { applyEvent, localEmergency, toHistory, type Msg } from "@/lib/chat/messages";
import { usePref } from "@/lib/prefs/store";
import { useProfile } from "@/lib/profile/store";
import { speak, stopSpeaking } from "@/lib/voice/speech";

/** All the state and actions of a conversation. The components only draw it. */
export function useChat() {
  const { lang, speechLang } = useI18n();
  const profile = useProfile();
  const autoRead = usePref("autoRead");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const latest = useRef<Msg[]>([]);
  const counter = useRef(0);

  useEffect(() => {
    latest.current = messages;
  }, [messages]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      stopSpeaking();
    },
    [],
  );

  const patch = useCallback((id: string, fn: (m: Msg) => Msg) => {
    setMessages((all) => all.map((m) => (m.id === id ? fn(m) : m)));
  }, []);

  /** Offline or server unreachable: still give the worker something useful from the on-device knowledge base. */
  const answerOffline = useCallback(
    async (botId: string, question: string) => {
      const ids = await offlineAnswerIds(question, profile.state);
      patch(botId, (m) => ({ ...m, error: "offline", fallback: ids.length ? ids : m.fallback }));
    },
    [patch, profile.state],
  );

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busy) return;

      const botId = `a${++counter.current}`;
      const history = toHistory(latest.current);
      // The emergency check runs on the device, before any network call.
      setMessages((all) => [
        ...all,
        { id: `u${++counter.current}`, role: "user", text },
        { id: botId, role: "assistant", text: "", streaming: true, emergency: localEmergency(text) },
      ]);
      setBusy(true);
      stopSpeaking(); // a new question silences the last answer

      const ac = new AbortController();
      abortRef.current = ac;
      let answer = ""; // the whole reply, so it can be read aloud when it finishes

      try {
        await streamChat(
          {
            messages: [...history, { role: "user", text }],
            lang,
            today: todayISO(),
            ...(Object.keys(profile).length > 0 && { profile }),
          },
          (e) => {
            if (e.type === "text") answer += e.text;
            patch(botId, (m) => applyEvent(m, e));
          },
          ac.signal,
        );
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") await answerOffline(botId, text);
      } finally {
        patch(botId, (m) => ({ ...m, streaming: false, tool: undefined }));
        setBusy(false);
        abortRef.current = null;
        if (autoRead && answer.trim() && !ac.signal.aborted) void speak(answer, speechLang);
      }
    },
    [busy, lang, profile, patch, answerOffline, autoRead, speechLang],
  );

  const retry = useCallback(() => {
    const all = latest.current;
    const lastUser = [...all].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setMessages(all.slice(0, all.lastIndexOf(lastUser)));
    void send(lastUser.text);
  }, [send]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setBusy(false);
  }, []);

  return { messages, busy, send, retry, reset, stop: () => abortRef.current?.abort() };
}
