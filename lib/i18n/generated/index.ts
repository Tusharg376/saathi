import type { LangCode, Messages } from "../messages";
import bn from "./bn.json";
import gu from "./gu.json";
import kn from "./kn.json";
import mr from "./mr.json";
import ta from "./ta.json";
import te from "./te.json";

/**
 * UI strings written by `npm run translate:ui` and checked by lib/i18n/translate-utils.ts.
 * Each file starts empty; any key missing from a language falls back to English.
 * Machine translations need a native speaker's review before real-world use.
 */
export const generated: Partial<Record<LangCode, Partial<Messages>>> = { bn, gu, kn, mr, ta, te };
