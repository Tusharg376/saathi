/**
 * Translates the UI strings into the other launch languages with Gemini.
 *
 *   npm run translate:ui                 all machine-translated languages (mr bn ta te kn gu)
 *   npm run translate:ui -- ta te        only these
 *   npm run translate:ui -- --dry        show results, write nothing
 *
 * Every string is checked before it is kept (see lib/i18n/translate-utils.ts): placeholders
 * must match, numbers must survive, nothing runaway. Rejected strings are left out and the
 * app falls back to English for them. Re-run to retry only what is missing.
 *
 * Output is machine translation. Have a native speaker review lib/i18n/generated/*.json.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { LlmUnavailableError, generateJSON, hasApiKey, userText } from "../lib/llm/gemini";
import { LANGUAGES, en, isLangCode, type LangCode } from "../lib/i18n/messages";
import { acceptUiTranslations, batches } from "../lib/i18n/translate-utils";

const DEFAULT_TARGETS: LangCode[] = ["mr", "bn", "ta", "te", "kn", "gu"]; // en and hi are hand-written
const BATCH = 40;
const OUT_DIR = path.join(import.meta.dirname, "../lib/i18n/generated");

function systemPrompt(language: string): string {
  return `You translate the user interface of "Saathi", a helper app for gig and informal workers in India (delivery partners, drivers, daily-wage workers), from English into ${language}.

Rules:
- Use simple, everyday words a person with limited schooling understands. Short sentences. Polite "you" form. No slang, no heavy Sanskritised or literary words.
- Keep {placeholders} like {pct} or {amount} EXACTLY as written, letter for letter. Never translate or reorder them in a way that drops one.
- Keep every digit as an ASCII number (0-9). Never convert to native digits. Keep amounts such as "Rs 15,000" and helpline numbers unchanged.
- Keep brand and technical names as they are: Saathi, WhatsApp, SOS, UAN, e-Shram, PM-SYM, CSV, PDF, AI, OTP, PIN.
- Do not add, remove or soften any information. Do not add explanations.
- Return a JSON object with exactly the same keys as the input.`;
}

async function translateLanguage(code: LangCode, dry: boolean) {
  const language = LANGUAGES.find((l) => l.code === code)!.english;
  const file = path.join(OUT_DIR, `${code}.json`);
  const existing: Record<string, string> = JSON.parse(await readFile(file, "utf8").catch(() => "{}"));

  // Only ask for what is missing, so re-runs are cheap and fix just the failures.
  const missing = Object.keys(en).filter((k) => !existing[k]);
  if (missing.length === 0) return console.log(`${code}: already complete (${Object.keys(en).length} strings)`);

  const result = { ...existing };
  const rejected: { key: string; reason: string }[] = [];

  for (const keys of batches(missing, BATCH)) {
    const source = Object.fromEntries(keys.map((k) => [k, en[k as keyof typeof en] as string]));
    const schema = z.object(Object.fromEntries(keys.map((k) => [k, z.string()])));
    const out = await generateJSON([userText(JSON.stringify(source, null, 2))], schema, {
      model: "primary",
      system: systemPrompt(language),
      temperature: 0.2,
    });
    const { accepted, rejected: bad } = acceptUiTranslations(source, out);
    Object.assign(result, accepted);
    rejected.push(...bad);
    process.stdout.write(".");
  }

  const total = Object.keys(en).length;
  console.log(
    `\n${code} (${language}): ${Object.keys(result).length}/${total} strings kept, ${rejected.length} rejected`,
  );
  for (const r of rejected) console.log(`   skipped ${r.key}: ${r.reason}`);

  if (!dry) {
    const sorted = Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
    await writeFile(file, JSON.stringify(sorted, null, 2) + "\n", "utf8");
  }
}

async function main() {
  if (!hasApiKey()) {
    console.error("GEMINI_API_KEY is not set. Add it to .env.local and run: npm run translate:ui");
    process.exit(2);
  }
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const asked = args.filter((a) => !a.startsWith("--"));
  const bad = asked.filter((a) => !isLangCode(a) || a === "en" || a === "hi");
  if (bad.length) {
    console.error(`Not a machine-translated language: ${bad.join(", ")}. Choose from: ${DEFAULT_TARGETS.join(" ")}`);
    process.exit(2);
  }
  const targets = (asked.length ? asked : DEFAULT_TARGETS) as LangCode[];

  for (const code of targets) await translateLanguage(code, dry);
  console.log(
    dry ? "\nDry run: nothing written." : "\nDone. Please have a native speaker review lib/i18n/generated/*.json.",
  );
}

main().catch((err) => {
  if (err instanceof LlmUnavailableError) {
    console.error(err.message);
    process.exit(2);
  }
  console.error("translate:ui failed:", err);
  process.exit(1);
});
