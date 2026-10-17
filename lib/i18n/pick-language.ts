import { DEFAULT_LANG, isLangCode, type LangCode } from "./languages";

/** The cookie that carries the worker's chosen language to the server, so the first page already arrives in it. */
export const LANG_COOKIE = "saathi.lang";

/** A header from the network is untrusted input: read only a bounded amount of it. */
const MAX_HEADER = 500;

/**
 * The first language in an `Accept-Language` header that the app offers, honouring the quality
 * weights (`ta;q=0.9, en;q=0.8`) and ignoring anything the app does not have.
 */
function fromAcceptLanguage(header: string | null | undefined): LangCode | null {
  if (!header) return null;
  const ranked = header
    .slice(0, MAX_HEADER)
    .split(",")
    .map((part, order) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = Number(
        params
          .find((p) => p.trim().startsWith("q="))
          ?.trim()
          .slice(2) ?? 1,
      );
      return { base: tag.toLowerCase().split("-")[0] ?? "", q: Number.isFinite(q) ? q : 0, order };
    })
    .filter((x) => x.q > 0)
    .sort((a, b) => b.q - a.q || a.order - b.order);
  return ranked.map((x) => x.base).find(isLangCode) ?? null;
}

/**
 * Which language the first page should be written in: the one the worker chose last time (cookie),
 * else the phone's own language, else Hindi. Deciding it on the server is what lets the page arrive
 * in the right language, instead of showing Hindi first and switching once the app has started.
 */
export function pickLanguage(saved: string | undefined, acceptLanguage: string | null | undefined): LangCode {
  return isLangCode(saved) ? saved : (fromAcceptLanguage(acceptLanguage) ?? DEFAULT_LANG);
}
