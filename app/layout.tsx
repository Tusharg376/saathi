import type { Metadata, Viewport } from "next";
import {
  Archivo,
  Noto_Sans,
  Noto_Sans_Bengali,
  Noto_Sans_Devanagari,
  Noto_Sans_Gujarati,
  Noto_Sans_Kannada,
  Noto_Sans_Tamil,
  Noto_Sans_Telugu,
} from "next/font/google";
import { I18nProvider } from "@/lib/i18n/provider";
import { AppShell } from "@/components/AppShell";
import { PrefsEffects } from "@/components/PrefsEffects";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

/* Display + numbers: Archivo has a width axis, so plates can use a tall, narrow cut like real plates. */
const display = Archivo({ subsets: ["latin"], variable: "--f-display", axes: ["wdth"], display: "swap" });
const body = Noto_Sans({ subsets: ["latin"], variable: "--f-body", display: "swap" });

/*
 * One Noto family per script, so every language looks like one voice. preload is
 * off: the browser only downloads a script's file (unicode-range) when that
 * script is on screen, which matters on slow mobile data.
 */
/* Options are written out per call: next/font only accepts literals it can read at build time (no spreads). */
const deva = Noto_Sans_Devanagari({ subsets: ["devanagari"], variable: "--f-deva", display: "swap", preload: false });
const tamil = Noto_Sans_Tamil({ subsets: ["tamil"], variable: "--f-tamil", display: "swap", preload: false });
const telugu = Noto_Sans_Telugu({ subsets: ["telugu"], variable: "--f-telugu", display: "swap", preload: false });
const kannada = Noto_Sans_Kannada({ subsets: ["kannada"], variable: "--f-kannada", display: "swap", preload: false });
const bengali = Noto_Sans_Bengali({ subsets: ["bengali"], variable: "--f-bengali", display: "swap", preload: false });
const gujarati = Noto_Sans_Gujarati({ subsets: ["gujarati"], variable: "--f-gujarati", display: "swap", preload: false });

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

export default function RootLayout({ children }: LayoutProps<"/">) {
  const fonts = [display, body, deva, tamil, telugu, kannada, bengali, gujarati].map((f) => f.variable).join(" ");
  return (
    <html lang="hi" className={`${fonts} h-full antialiased`}>
      <body className="min-h-full">
        <I18nProvider>
          <AppShell>{children}</AppShell>
        </I18nProvider>
        <PrefsEffects />
        <PwaRegister />
      </body>
    </html>
  );
}
