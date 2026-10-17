import { cookies, headers } from "next/headers";
import type { LangCode } from "./languages";
import { LANG_COOKIE, pickLanguage } from "./pick-language";

/** The language for the request being rendered. Reading the request makes the page render per visitor. */
export async function requestLanguage(): Promise<LangCode> {
  const [jar, incoming] = await Promise.all([cookies(), headers()]);
  return pickLanguage(jar.get(LANG_COOKIE)?.value, incoming.get("accept-language"));
}
