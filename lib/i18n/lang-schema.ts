import { z } from "zod";
import { LANGUAGES, type LangCode } from "./messages";

/** Request-validation enum derived from LANGUAGES, so a new language is added in exactly one place. */
export const LangSchema = z.enum(LANGUAGES.map((l) => l.code) as [LangCode, ...LangCode[]]);
