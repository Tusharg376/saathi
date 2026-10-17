"use client";

import { useCallback, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/messages";
import { addEntries } from "@/lib/db";
import { todayISO } from "@/lib/earnings/dates";
import { requestParse, type ParseOutcome } from "@/lib/earnings/client";
import {
  draftFromEntry,
  emptyDraft,
  validateDrafts,
  type Draft,
  type DraftErrors,
} from "@/lib/earnings/draft";
import type { NewEntry } from "@/lib/earnings/math";
import { ImageError, fileToJpeg } from "@/lib/image/downscale";

export type Busy = "text" | "photo" | "save" | null;
export type Notice = { key: MessageKey; tone: "error" | "info" } | null;

const FAILURE_NOTICE: Record<Exclude<ParseOutcome["kind"], "entries" | "question">, Notice> = {
  no_key: { key: "earn.err.no_key", tone: "info" },
  rate_limited: { key: "earn.err.rate", tone: "error" },
  offline: { key: "earn.err.parse", tone: "error" },
  failed: { key: "earn.err.parse", tone: "error" },
};

/** All the state and actions behind the "add earnings" sheet. The component only draws it. */
export function useAddEarnings(onSaved: () => void) {
  const { lang } = useI18n();
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [errors, setErrors] = useState<DraftErrors[]>([]);
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [question, setQuestion] = useState("");

  /** Start fresh, optionally with entries already filled in (e.g. proposed by the chat). */
  const reset = useCallback((initial?: NewEntry[]) => {
    setDrafts(initial?.length ? initial.map(draftFromEntry) : [emptyDraft(todayISO())]);
    setErrors([]);
    setText("");
    setNotice(null);
    setQuestion("");
  }, []);

  const applyOutcome = (outcome: ParseOutcome) => {
    if (outcome.kind === "entries") {
      setDrafts(outcome.entries.map(draftFromEntry));
      setErrors([]);
    } else if (outcome.kind === "question") {
      setQuestion(outcome.question);
    } else {
      setNotice(FAILURE_NOTICE[outcome.kind]);
    }
  };

  const read = async (kind: "text" | "photo", body: { text?: string; image?: { mimeType: "image/jpeg"; data: string } }) => {
    setBusy(kind);
    setNotice(null);
    setQuestion("");
    applyOutcome(await requestParse({ ...body, lang, today: todayISO() }));
    setBusy(null);
  };

  const parseText = () => read("text", { text });

  const parsePhoto = async (file: File) => {
    setBusy("photo");
    try {
      const img = await fileToJpeg(file);
      await read("photo", { image: { mimeType: img.mimeType, data: img.data } });
    } catch (e) {
      setBusy(null);
      setNotice({ key: e instanceof ImageError ? "earn.err.image" : "earn.err.parse", tone: "error" });
    }
  };

  const save = async () => {
    const result = validateDrafts(drafts, todayISO());
    if (!result.ok) return setErrors(result.errors);
    setBusy("save");
    try {
      await addEntries(result.entries);
      onSaved();
    } catch {
      setNotice({ key: "earn.err.storage", tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  return {
    text,
    setText,
    drafts,
    errors,
    busy,
    notice,
    question,
    reset,
    parseText,
    parsePhoto,
    save,
    updateDraft: (i: number, d: Draft) => setDrafts((all) => all.map((x, j) => (j === i ? d : x))),
    removeDraft: (i: number) => {
      setDrafts((all) => all.filter((_, j) => j !== i));
      setErrors((all) => all.filter((_, j) => j !== i));
    },
    addDraft: () => setDrafts((all) => [...all, emptyDraft(todayISO())]),
  };
}
