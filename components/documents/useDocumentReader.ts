"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/messages";
import { requestDocument } from "@/lib/documents/client";
import type { NormalizedInsight } from "@/lib/documents/insight";
import type { FailureKind } from "@/lib/http/postJson";
import { ImageError, fileToJpeg } from "@/lib/image/downscale";

export type ReaderPhase =
  | { name: "pick" }
  | { name: "reading" }
  | { name: "done"; insight: NormalizedInsight }
  | { name: "error"; key: MessageKey };

const FAILURE_TEXT: Record<FailureKind, MessageKey> = {
  no_key: "doc.err.no_key",
  rate_limited: "earn.err.rate",
  offline: "doc.err.generic",
  failed: "doc.err.generic",
};

/** Photo in, explanation out. The photo lives only in memory and is released when replaced or left behind. */
export function useDocumentReader() {
  const { lang } = useI18n();
  const [phase, setPhase] = useState<ReaderPhase>({ name: "pick" });
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const read = async (file: File) => {
    setPreview(URL.createObjectURL(file));
    setPhase({ name: "reading" });
    try {
      const image = await fileToJpeg(file);
      const outcome = await requestDocument({
        image: { mimeType: image.mimeType, data: image.data },
        note: note.trim() || undefined,
        lang,
      });
      setPhase(
        outcome.kind === "insight"
          ? { name: "done", insight: outcome.insight }
          : { name: "error", key: FAILURE_TEXT[outcome.kind] },
      );
    } catch (e) {
      setPhase({ name: "error", key: e instanceof ImageError ? "earn.err.image" : "doc.err.generic" });
    }
  };

  const reset = () => {
    setPreview(null);
    setPhase({ name: "pick" });
  };

  return { phase, note, setNote, preview, read, reset };
}
