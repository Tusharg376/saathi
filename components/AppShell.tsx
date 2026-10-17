"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { Globe, IndianRupee, LifeBuoy, MessageCircle, Scale, Siren } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import { LANGUAGES, isInterfaceComplete, type MessageKey } from "@/lib/i18n/messages";
import { setPref, usePref, type PrefKey } from "@/lib/prefs/store";

/**
 * Only routes that exist today. Each feature adds its tab when it lands, so the
 * nav never points at a dead page.
 */
const TABS: { href: string; key: MessageKey; Icon: typeof Globe; prefetch?: false }[] = [
  { href: "/", key: "nav.chat", Icon: MessageCircle },
  // Earnings carries the on-device database with it (about 40 KB). Fetching that in the background on every
  // screen costs data most visits never use, so it loads when the tab is tapped. The offline worker still
  // saves it ahead of time, so for someone who has used the app before it opens at once anyway.
  { href: "/earnings", key: "nav.earnings", Icon: IndianRupee, prefetch: false },
  { href: "/rights", key: "nav.rights", Icon: Scale },
  { href: "/help", key: "nav.help", Icon: LifeBuoy },
];

/** A labelled on/off switch for an on-device preference. */
function PrefSwitch({ pref, label }: { pref: PrefKey; label: string }) {
  const on = usePref(pref);
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border-2 border-tarmac px-3">
      <span className="font-bold">{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={on}
        onChange={(e) => setPref(pref, e.target.checked)}
        className="size-6 shrink-0 accent-tarmac"
      />
    </label>
  );
}

function LanguageSheet() {
  const { lang, setLang, t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const current = LANGUAGES.find((l) => l.code === lang);

  // Close on backdrop click.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onClick = (e: MouseEvent) => {
      if (e.target === d) d.close();
    };
    d.addEventListener("click", onClick);
    return () => d.removeEventListener("click", onClick);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="flex min-h-11 items-center gap-2 rounded-full border-2 border-tarmac bg-paper px-3 text-sm font-bold active:bg-line"
      >
        <Globe size={18} aria-hidden />
        {/* No aria-label: a label that leaves out the visible word would break voice control ("click English"). */}
        <span className="sr-only">{t("lang.choose")}:</span> <span lang={current?.code}>{current?.native}</span>
      </button>

      <dialog
        ref={ref}
        className="m-auto w-[min(92vw,26rem)] rounded-2xl border-4 border-tarmac bg-paper p-0 backdrop:bg-tarmac/60"
        aria-label={t("lang.choose")}
      >
        <div className="p-4">
          <h2 className="mb-3 text-lg font-extrabold">{t("prefs.title")}</h2>
          <ul className="grid grid-cols-2 gap-2">
            {LANGUAGES.map((l) => (
              <li key={l.code}>
                <button
                  type="button"
                  onClick={() => {
                    setLang(l.code);
                    // Stay open on a language whose screens are not translated yet, so the note below is seen.
                    if (isInterfaceComplete(l.code)) ref.current?.close();
                  }}
                  lang={l.code}
                  aria-pressed={l.code === lang}
                  className={`min-h-14 w-full rounded-xl border-2 border-tarmac px-3 text-lg font-bold active:bg-plate-deep ${
                    l.code === lang ? "bg-plate" : "bg-paper"
                  }`}
                >
                  {l.native}
                </button>
              </li>
            ))}
          </ul>
          {!isInterfaceComplete(lang) && (
            // The AI answers in the chosen language; the screens only follow once their translation exists.
            <p className="mt-3 rounded-xl border-2 border-dashed border-tarmac p-3 text-sm font-bold">
              {t("lang.partial")}
            </p>
          )}
          <div className="mt-3 space-y-2">
            <PrefSwitch pref="largeText" label={t("prefs.large")} />
            <PrefSwitch pref="autoRead" label={t("prefs.autoread")} />
          </div>
          <form method="dialog" className="mt-4">
            <button className="min-h-12 w-full rounded-xl bg-tarmac px-4 font-bold text-white active:opacity-80">
              {t("lang.close")}
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t, lang } = useI18n();
  const pathname = usePathname();

  return (
    <div lang={lang} className="mx-auto flex min-h-dvh w-full max-w-xl flex-col bg-dust">
      <header className="sticky top-0 z-20 flex h-[var(--top-h)] items-center justify-between gap-2 border-b-2 border-tarmac bg-dust px-3 print:hidden">
        {/* The link is a full 44px target; the words inside line up on their baseline. */}
        <Link href="/" className="flex min-h-11 min-w-11 shrink-0 items-center">
          <span className="flex items-baseline gap-2">
            <span lang="hi" className="font-brand text-2xl font-extrabold leading-none">
              साथी
            </span>
            {/*
              The Latin half of the wordmark is only drawn when there is room (375px phones are the floor), but always
              read out. The display font is applied only where it is drawn: a font is downloaded for any text that is
              laid out, even clipped, so applying it everywhere cost narrow phones a 90 KB file for invisible text.
            */}
            <span className="sr-only text-lg font-extrabold uppercase tracking-wide text-ink-soft [font-stretch:85%] min-[430px]:not-sr-only min-[430px]:font-display">
              Saathi
            </span>
          </span>
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          <LanguageSheet />
          <Link
            href="/sos"
            className="flex min-h-11 items-center gap-1.5 rounded-full bg-signal px-4 font-extrabold text-white active:opacity-80"
          >
            <Siren size={18} aria-hidden />
            {t("top.sos")}
          </Link>
        </div>
      </header>

      <main className="flex-1 pb-[calc(var(--nav-h)+1rem)]">{children}</main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 mx-auto h-[var(--nav-h)] w-full max-w-xl border-t-2 border-tarmac bg-paper pb-[env(safe-area-inset-bottom)] print:hidden"
      >
        <ul className="flex h-full">
          {TABS.map(({ href, key, Icon, prefetch }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={href} className="relative flex-1">
                {/* The lane marking: a yellow bar marks where you are */}
                {active && <span aria-hidden className="absolute inset-x-3 top-0 h-1.5 rounded-b bg-plate" />}
                <Link
                  href={href}
                  prefetch={prefetch}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-full flex-col items-center justify-center gap-0.5 text-sm ${
                    active ? "font-extrabold" : "font-semibold text-ink-soft"
                  }`}
                >
                  <Icon size={24} aria-hidden strokeWidth={active ? 2.75 : 2} />
                  {t(key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
