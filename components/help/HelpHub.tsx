"use client";

import Link from "next/link";
import { Camera, PenLine } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/messages";

const ITEMS: { href: string; title: MessageKey; sub: MessageKey; Icon: typeof Camera }[] = [
  { href: "/help/documents", title: "help.docs", sub: "help.docs_sub", Icon: Camera },
  { href: "/help/complaint", title: "help.complaint", sub: "help.complaint_sub", Icon: PenLine },
];

export function HelpHub() {
  const { t } = useI18n();
  return (
    <div className="space-y-4 px-4 py-5">
      <h1 className="text-2xl font-extrabold">{t("help.title")}</h1>
      <ul className="space-y-3">
        {ITEMS.map(({ href, title, sub, Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex min-h-28 items-center gap-4 rounded-2xl border-2 border-tarmac bg-paper p-4 active:bg-plate"
            >
              <Icon size={40} aria-hidden strokeWidth={2.25} className="shrink-0" />
              <span>
                <span className="block text-xl font-extrabold leading-snug">{t(title)}</span>
                <span className="block text-ink-soft">{t(sub)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-center text-sm text-ink-soft">{t("disclaimer")}</p>
    </div>
  );
}
