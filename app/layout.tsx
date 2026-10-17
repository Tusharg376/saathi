import type { Metadata, Viewport } from "next";
import { Suspense, type ReactNode } from "react";
import {
  Noto_Sans,
  Noto_Sans_Bengali,
  Noto_Sans_Gujarati,
  Noto_Sans_Kannada,
  Noto_Sans_Tamil,
  Noto_Sans_Telugu,
} from "next/font/google";
import localFont from "next/font/local";
import { I18nProvider } from "@/lib/i18n/provider";
import { requestLanguage } from "@/lib/i18n/request-language";
import { AppShell } from "@/components/AppShell";
import { PrefsEffects } from "@/components/PrefsEffects";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

/*
 * The three small font files below are cut out of Google's fonts (all SIL Open Font License) with fontTools,
 * because the full files are far larger than the few letters this app draws with them:
 *   - Archivo, weight 800 and 85% width, plain Latin only (8 KB instead of 88 KB). It is the tall, narrow
 *     cut the number plates use. Every plate, amount and the Latin wordmark is set in exactly that cut.
 *   - The rupee sign alone, from Noto Sans (1 KB). Google ships it inside the 164 KB Latin Extended file and
 *     again inside the 97 KB Devanagari file, and the browser downloads both whenever a screen shows one "₹".
 *     Listed first in each font stack with a one-character unicode-range, the rest are never asked for.
 *   - The four letters of the साथी wordmark at weight 800 (1 KB). It is on every screen, so without it the
 *     whole Devanagari file was downloaded for four letters, even for someone reading in English.
 * Rebuild one with: instancer.instantiateVariableFont (pin wght/wdth) then fontTools.subset to the characters
 * above, flavor woff2. None is preloaded: most screens show no plate or rupee, and each is tiny when needed.
 * adjustFontFallback is off for all three: next/font would otherwise add an "Arial" stand-in right after each one
 * with no unicode-range, so it would catch every character the small font lacks, and all body text would be
 * drawn in Arial instead of reaching Noto Sans.
 */
const display = localFont({
  src: "./fonts/archivo-plate.woff2",
  variable: "--f-display",
  weight: "800",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});
const rupee = localFont({
  src: "./fonts/rupee-sign.woff2",
  variable: "--f-rupee",
  weight: "100 900",
  // "block", not "swap": while a swap font is still loading, the browser tries the next font in the list for
  // that character, and Google's Noto Sans files list the rupee sign twice (164 KB and 97 KB). A phone with
  // no Arial to fall back on would download both. One sign hidden for a moment is far cheaper.
  display: "block",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+20B9" }],
});
const brand = localFont({
  src: "./fonts/saathi-wordmark.woff2",
  variable: "--f-brand",
  weight: "800",
  // "block" for the same reason as the rupee sign: while this 1 KB file loads, a swap font would let the browser
  // try Noto Sans for the four letters, and that is the 97 KB Devanagari file.
  display: "block",
  adjustFontFallback: false,
});
const body = Noto_Sans({ subsets: ["latin"], variable: "--f-body", display: "swap" });

/*
 * Noto Sans already carries Devanagari (Hindi, Marathi), so only the other scripts need a family of their
 * own, and every language still looks like one voice. preload is off: the browser only downloads a
 * script's file (unicode-range) when that script is on screen, which matters on slow mobile data.
 */
/* Options are written out per call: next/font only accepts literals it can read at build time (no spreads). */
const tamil = Noto_Sans_Tamil({ subsets: ["tamil"], variable: "--f-tamil", display: "swap", preload: false });
const telugu = Noto_Sans_Telugu({ subsets: ["telugu"], variable: "--f-telugu", display: "swap", preload: false });
const kannada = Noto_Sans_Kannada({ subsets: ["kannada"], variable: "--f-kannada", display: "swap", preload: false });
const bengali = Noto_Sans_Bengali({ subsets: ["bengali"], variable: "--f-bengali", display: "swap", preload: false });
const gujarati = Noto_Sans_Gujarati({
  subsets: ["gujarati"],
  variable: "--f-gujarati",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Saathi · साथी",
  description:
    "A multilingual companion for delivery partners, drivers and daily-wage workers: earnings, safety, rights and schemes, documents and complaints in simple language.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6c700",
};

/**
 * Works out the visitor's language on the server (saved choice, else the phone's language) and
 * writes the whole first page in it. Without this the HTML always arrived in Hindi and switched
 * language only after the app had downloaded and started, which a slow phone saw as a flash of the
 * wrong language and a late, jumpy first screen.
 *
 * The price: reading the request means each visit is rendered when asked for (a few milliseconds here)
 * instead of served as a ready-made file, and the page is sent with "no-store", so the browser's
 * back/forward cache no longer keeps it. The language is also not known to <html lang> in the first bytes,
 * so the shell below carries lang for its own content and the provider sets <html lang> once it starts.
 */
async function Localised({ children }: { children: ReactNode }) {
  const lang = await requestLanguage();
  return (
    <I18nProvider serverLang={lang}>
      <AppShell>{children}</AppShell>
    </I18nProvider>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  const fonts = [display, rupee, body, brand, tamil, telugu, kannada, bengali, gujarati]
    .map((f) => f.variable)
    .join(" ");
  return (
    <html lang="hi" className={`${fonts} h-full antialiased`}>
      <body className="min-h-full">
        <Suspense fallback={null}>
          <Localised>{children}</Localised>
        </Suspense>
        <PrefsEffects />
        <PwaRegister />
      </body>
    </html>
  );
}
