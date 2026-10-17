"use client";

import { Check, Copy, Mail, MessageCircle, Printer } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { copyText, mailtoUrl, whatsappUrl } from "@/lib/grievance/share";

const button = "flex min-h-12 items-center gap-2 rounded-full border-2 border-tarmac bg-paper px-4 font-bold active:bg-line";

/**
 * Ways to take the finished letter out of the app. Each one only opens another app (or the print
 * dialog) with the text ready: nothing is sent for the worker.
 */
export function ShareActions({ letter, subject }: { letter: string; subject: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (await copyText(letter)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const email = async () => {
    const mail = mailtoUrl(subject, letter);
    // Too long for a link: put the whole letter on the clipboard rather than cut it short.
    if (mail.needsPaste) await copy();
    window.location.href = mail.href;
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => void copy()} className={button}>
        {copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
        {copied ? t("cmp.copied") : t("cmp.copy")}
      </button>
      <button type="button" onClick={() => window.open(whatsappUrl(letter), "_blank", "noopener")} className={button}>
        <MessageCircle size={18} aria-hidden />
        {t("cmp.whatsapp")}
      </button>
      <button type="button" onClick={() => void email()} className={button}>
        <Mail size={18} aria-hidden />
        {t("cmp.email")}
      </button>
      <button type="button" onClick={() => window.print()} className={button}>
        <Printer size={18} aria-hidden />
        {t("cmp.print")}
      </button>
    </div>
  );
}
