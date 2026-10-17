"use client";

import { useState } from "react";
import { MapPin, Phone, WifiOff } from "lucide-react";
import { Plate } from "./Plate";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/messages";

/* Static on purpose: this screen must work with no network and no AI. */
const NUMBERS: { number: string; label: MessageKey; tone: "signal" | "plate" }[] = [
  { number: "112", label: "sos.plate.emergency", tone: "signal" },
  { number: "108", label: "sos.plate.ambulance", tone: "signal" },
  { number: "181", label: "sos.plate.women", tone: "plate" },
  { number: "1930", label: "sos.plate.cyber", tone: "plate" },
];

type LocState = "idle" | "locating" | "error";

export function SosPanel() {
  const { t } = useI18n();
  const [loc, setLoc] = useState<LocState>("idle");

  function shareLocation() {
    if (!("geolocation" in navigator)) {
      setLoc("error");
      return;
    }
    setLoc("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const map = `https://maps.google.com/?q=${latitude},${longitude}`;
        const text = `${t("sos.share_text")} ${map}`;
        setLoc("idle");
        // The worker picks who receives it inside WhatsApp. Nothing is sent automatically.
        window.location.assign(`https://wa.me/?text=${encodeURIComponent(text)}`);
      },
      () => setLoc("error"),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }

  return (
    <div className="space-y-6 px-4 py-5">
      <div>
        <h1 className="text-2xl font-extrabold">{t("sos.title")}</h1>
        <p className="text-ink-soft">{t("sos.subtitle")}</p>
      </div>

      <ul className="space-y-3">
        {NUMBERS.map(({ number, label, tone }) => (
          <li key={number}>
            <a
              href={`tel:${number}`}
              className="flex min-h-20 items-center justify-between gap-3 rounded-2xl border-2 border-tarmac bg-paper p-3 active:bg-line"
            >
              <Plate value={number} label={t(label)} size="md" tone={tone} />
              <span className="flex items-center gap-2 rounded-full bg-tarmac px-4 py-2.5 font-extrabold text-white">
                <Phone size={20} aria-hidden />
                {t("sos.call")}
              </span>
            </a>
          </li>
        ))}
      </ul>

      <section aria-labelledby="sos-steps" className="rounded-2xl border-2 border-tarmac bg-paper p-4">
        <h2 id="sos-steps" className="mb-2 text-lg font-extrabold">
          {t("sos.steps.title")}
        </h2>
        <ol className="list-decimal space-y-1.5 pl-6 marker:font-extrabold">
          <li>{t("sos.step1")}</li>
          <li>{t("sos.step2")}</li>
          <li>{t("sos.step3")}</li>
        </ol>
      </section>

      <div>
        <button
          type="button"
          onClick={shareLocation}
          disabled={loc === "locating"}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-highway px-4 text-lg font-extrabold text-white active:opacity-80 disabled:opacity-60"
        >
          <MapPin size={22} aria-hidden />
          {loc === "locating" ? t("sos.locating") : t("sos.share")}
        </button>
        {loc === "locating" && <div className="road-dash mt-3" role="status" aria-label={t("sos.locating")} />}
        {loc === "error" && (
          <p role="alert" className="mt-3 rounded-xl border-2 border-signal bg-paper p-3 text-signal">
            {t("sos.location_error")}
          </p>
        )}
      </div>

      <p className="flex items-center gap-2 text-sm text-ink-soft">
        <WifiOff size={16} aria-hidden />
        {t("sos.offline")}
      </p>
    </div>
  );
}
