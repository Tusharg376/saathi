"use client";

import { Camera, ImageUp } from "lucide-react";
import { useRef } from "react";
import { useI18n } from "@/lib/i18n/provider";

/** Two big ways to supply a photo: the camera, or something already on the phone. */
export function PhotoPicker({ disabled, onPick }: { disabled: boolean; onPick: (file: File) => void }) {
  const { t } = useI18n();
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);

  const handle = (e: { target: HTMLInputElement }) => {
    const file = e.target.files?.[0];
    if (file) onPick(file);
    e.target.value = ""; // allow choosing the same photo again
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => camera.current?.click()}
        className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl bg-tarmac p-3 text-lg font-extrabold text-white active:opacity-80 disabled:opacity-40"
      >
        <Camera size={32} aria-hidden />
        {t("doc.take")}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => gallery.current?.click()}
        className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-tarmac bg-paper p-3 text-lg font-extrabold active:bg-line disabled:opacity-40"
      >
        <ImageUp size={32} aria-hidden />
        {t("doc.choose")}
      </button>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={handle} />
      <input ref={gallery} type="file" accept="image/*" hidden onChange={handle} />
    </div>
  );
}
