/**
 * Translates the knowledge-base cards (schemes, rights, safety, complaint routes) with Gemini,
 * so workers can read them in their own language even with no AI call at read time.
 *
 *   npm run translate:kb                 hi mr bn ta te kn gu
 *   npm run translate:kb -- hi           only Hindi
 *   npm run translate:kb -- hi --only scheme.pmsym --force
 *
 * Only titles, summaries and step lists are translated. Ids, status, links, helplines and
 * eligibility rules never change. Each field is checked (lib/i18n/translate-utils.ts): the
 * same numbers must appear, lists must keep their length. Anything that fails stays English.
 *
 * Output is machine translation of legal and welfare content. A native speaker with domain
 * knowledge MUST review lib/kb/data/i18n/*.json before real-world use.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { LlmUnavailableError, generateJSON, hasApiKey, userText } from "../lib/llm/gemini";
import { LANGUAGES, isLangCode, type LangCode } from "../lib/i18n/messages";
import { LIST_FIELDS, acceptKbTranslation, translatableFields, type KbTranslation } from "../lib/i18n/translate-utils";
import { allEntries } from "../lib/kb";
import type { KbEntry } from "../lib/kb/types";

const TARGETS: LangCode[] = ["hi", "mr", "bn", "ta", "te", "kn", "gu"];
const CONCURRENCY = 3;
const OUT_DIR = path.join(import.meta.dirname, "../lib/kb/data/i18n");

function systemPrompt(language: string): string {
  return `You translate welfare, worker-rights, safety and complaint information for gig and informal workers in India from English into ${language}.

Rules:
- Use simple, everyday words a person with limited schooling understands. Short sentences. Polite "you" form.
- Be exact. Do not add, remove, strengthen or soften any fact, condition, age, amount or deadline.
- Keep every number exactly as written, as ASCII digits (0-9): ages, amounts like "Rs 3,000", dates, and helpline numbers like 14434, 112, 1930.
- Keep names and acronyms as they are: PM-SYM, PMSBY, PMJJBY, PM-JAY, e-Shram, UAN, EPFO, ESIC, NPS, CSC, BOCW, NALSA, DigiLocker, mParivahan, WhatsApp, and app names such as Swiggy or Uber.
- Return JSON with exactly the same fields as the input. Lists must have exactly the same number of items, in the same order.`;
}

function schemaFor(entry: KbEntry) {
  const shape: Record<string, z.ZodType> = { title: z.string(), summary: z.string() };
  if (entry.status_note) shape.status_note = z.string();
  for (const f of LIST_FIELDS) {
    const n = entry[f]?.length;
    if (n) shape[f] = z.array(z.string()).length(n); // enforces the item count in the model's schema
  }
  return z.object(shape);
}

async function inPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: limit }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await fn(item);
    }),
  );
}

async function translateLanguage(code: LangCode, opts: { only?: string; force: boolean; dry: boolean }) {
  const language = LANGUAGES.find((l) => l.code === code)!.english;
  const file = path.join(OUT_DIR, `${code}.json`);
  const table: Record<string, KbTranslation> = JSON.parse(await readFile(file, "utf8").catch(() => "{}"));

  const todo = allEntries().filter((e) => (!opts.only || e.id === opts.only) && (opts.force || !table[e.id]));
  if (todo.length === 0) return console.log(`${code}: nothing to do`);

  let kept = 0;
  const problems: { key: string; reason: string }[] = [];

  await inPool(todo, CONCURRENCY, async (entry) => {
    try {
      const out = await generateJSON([userText(JSON.stringify(translatableFields(entry), null, 2))], schemaFor(entry), {
        model: "primary",
        system: systemPrompt(language),
        temperature: 0.2,
      });
      const { accepted, rejected } = acceptKbTranslation(entry, out);
      if (Object.keys(accepted).length) {
        table[entry.id] = { ...table[entry.id], ...accepted };
        kept++;
      }
      problems.push(...rejected);
    } catch (err) {
      problems.push({ key: entry.id, reason: `request failed: ${(err as Error).message.slice(0, 80)}` });
    }
    process.stdout.write(".");
  });

  console.log(`\n${code} (${language}): ${kept}/${todo.length} entries translated, ${problems.length} problems`);
  for (const p of problems) console.log(`   skipped ${p.key}: ${p.reason}`);

  if (!opts.dry) {
    const sorted = Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b)));
    await writeFile(file, JSON.stringify(sorted, null, 2) + "\n", "utf8");
  }
}

async function main() {
  if (!hasApiKey()) {
    console.error("GEMINI_API_KEY is not set. Add it to .env.local and run: npm run translate:kb");
    process.exit(2);
  }
  const args = process.argv.slice(2);
  const onlyIdx = args.indexOf("--only");
  const only = onlyIdx >= 0 ? args[onlyIdx + 1] : undefined;
  const langs = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--only");
  const bad = langs.filter((a) => !isLangCode(a) || a === "en");
  if (bad.length) {
    console.error(`Unknown language: ${bad.join(", ")}. Choose from: ${TARGETS.join(" ")}`);
    process.exit(2);
  }
  const targets = (langs.length ? langs : TARGETS) as LangCode[];

  for (const code of targets) {
    await translateLanguage(code, { only, force: args.includes("--force"), dry: args.includes("--dry") });
  }
  console.log(
    "\nDone. A native speaker with domain knowledge must review lib/kb/data/i18n/*.json before real-world use.",
  );
}

main().catch((err) => {
  if (err instanceof LlmUnavailableError) {
    console.error(err.message);
    process.exit(2);
  }
  console.error("translate:kb failed:", err);
  process.exit(1);
});
