/** The launch languages. Adding one here is the first step; see README "Adding or improving a language". */
export const LANGUAGES = [
  { code: "hi", native: "हिन्दी", english: "Hindi", speech: "hi-IN" },
  { code: "en", native: "English", english: "English", speech: "en-IN" },
  { code: "mr", native: "मराठी", english: "Marathi", speech: "mr-IN" },
  { code: "bn", native: "বাংলা", english: "Bengali", speech: "bn-IN" },
  { code: "ta", native: "தமிழ்", english: "Tamil", speech: "ta-IN" },
  { code: "te", native: "తెలుగు", english: "Telugu", speech: "te-IN" },
  { code: "kn", native: "ಕನ್ನಡ", english: "Kannada", speech: "kn-IN" },
  { code: "gu", native: "ગુજરાતી", english: "Gujarati", speech: "gu-IN" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["code"];
export const DEFAULT_LANG: LangCode = "hi";

export function isLangCode(x: unknown): x is LangCode {
  return LANGUAGES.some((l) => l.code === x);
}
