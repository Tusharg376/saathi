"use client";

import Link from "next/link";
import { Camera, IndianRupee, PenLine, Scale, Siren } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/messages";

/** Each feature adds its tile when its page exists, so no tile ever points at a dead route. */
const TILES: { href: string; key: MessageKey; Icon: typeof Scale; cls: string; wide?: boolean }[] = [
  { href: "/earnings", key: "nav.earnings", Icon: IndianRupee, cls: "bg-plate text-tarmac" },
  { href: "/rights", key: "tile.rights", Icon: Scale, cls: "bg-paper text-tarmac" },
  { href: "/help/documents", key: "help.docs", Icon: Camera, cls: "bg-paper text-tarmac" },
  { href: "/help/complaint", key: "help.complaint", Icon: PenLine, cls: "bg-paper text-tarmac" },
  // wide: the grid item is the <li>, so the span must be on it, not on the link inside.
  { href: "/sos", key: "tile.sos", Icon: Siren, cls: "bg-signal text-white", wide: true },
];

const QUICK: MessageKey[] = ["chat.q1", "chat.q2", "chat.q3", "chat.q4"];

export function Welcome({ onAsk }: { onAsk: (text: string) => void }) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-extrabold leading-tight">{t("hub.greeting")}</h1>
        <p className="mt-1 text-lg text-ink-soft">{t("hub.subtitle")}</p>
      </div>

      <ul className="flex flex-col gap-2">
        {QUICK.map((k) => (
          <li key={k}>
            <button
              type="button"
              onClick={() => onAsk(t(k))}
              className="min-h-14 w-full rounded-2xl border-2 border-tarmac bg-paper px-4 py-2 text-left text-lg font-bold active:bg-plate"
            >
              {t(k)}
            </button>
          </li>
        ))}
      </ul>

      <ul className="grid grid-cols-2 gap-3">
        {TILES.map(({ href, key, Icon, cls, wide }) => (
          <li key={href} className={wide ? "col-span-2" : undefined}>
            <Link
              href={href}
              className={`flex min-h-32 flex-col justify-between rounded-2xl border-2 border-tarmac p-4 active:opacity-80 ${cls}`}
            >
              <Icon size={30} aria-hidden strokeWidth={2.25} />
              <span className="text-lg font-extrabold leading-snug">{t(key)}</span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-center text-sm text-ink-soft">{t("disclaimer")}</p>
    </div>
  );
}
