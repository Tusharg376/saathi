/**
 * Proves the Gemini adapter against a real key before anything depends on it:
 *   1. lists the models your key can call (so you can pin real ids in .env.local)
 *   2. one-shot text
 *   3. streamed Hindi reply
 *   4. structured JSON output
 *   5. a tool round-trip (thought-signature echo)
 *
 * Run: npm run smoke
 */
import { z } from "zod";
import {
  LlmUnavailableError,
  defineTool,
  generateJSON,
  generateText,
  hasApiKey,
  listGenerativeModels,
  runToolLoop,
  streamText,
  userText,
} from "../lib/llm/gemini";
import { MODELS } from "../lib/llm/models";

function step(name: string) {
  console.log(`\n=== ${name} ===`);
}

async function main() {
  if (!hasApiKey()) {
    console.error("GEMINI_API_KEY is not set. Copy .env.example to .env.local and add your key, then re-run.");
    process.exit(2);
  }
  console.log(`primary=${MODELS.primary}  fast=${MODELS.fast}`);

  step("1. models available to this key");
  const models = await listGenerativeModels();
  const gemini = models.filter((m) => m.startsWith("gemini"));
  console.log(gemini.join("\n") || "(none listed)");
  for (const [label, id] of [["primary", MODELS.primary], ["fast", MODELS.fast]] as const) {
    console.log(`${label} ${id}: ${models.includes(id) ? "OK" : "NOT FOUND in list, set GEMINI_MODEL_" + label.toUpperCase()}`);
  }

  step("2. one-shot text (fast)");
  console.log(await generateText("Reply with exactly one word: ready", { model: "fast", thinking: "minimal" }));

  step("3. streamed Hindi (primary)");
  let streamed = "";
  for await (const chunk of streamText([userText("e-Shram card kya hota hai? Do chhote vakyon mein batao.")], {
    system: "You help gig workers. Reply in simple Hindi (Devanagari), max 2 short sentences.",
  })) {
    streamed += chunk;
    process.stdout.write(chunk);
  }
  console.log(`\n(received ${streamed.length} chars)`);

  step("4. structured JSON");
  const Entry = z.object({
    platform: z.string(),
    orders: z.number().int(),
    gross_inr: z.number(),
    fuel_inr: z.number(),
  });
  const entry = await generateJSON(
    [userText("aaj Swiggy pe 12 order kiye, 1850 rupaye mile, petrol 400 laga")],
    Entry,
    { model: "fast", system: "Extract the earnings entry. Amounts are in INR." },
  );
  console.log(entry);

  step("5. tool round-trip");
  const events: string[] = [];
  let answer = "";
  for await (const ev of runToolLoop([userText("What is 17% of 2350? Use the calc tool.")], {
    system: "Always use the calc tool for arithmetic, then state the result.",
    tools: [
      defineTool({
        name: "calc",
        description: "Multiply two numbers.",
        args: z.object({ a: z.number(), b: z.number() }),
        run: ({ a, b }) => ({ product: a * b }),
      }),
    ],
  })) {
    if (ev.type === "text") answer += ev.text;
    else events.push(ev.type + ":" + ev.name);
  }
  console.log(events.join(", "));
  console.log(answer.trim());
  console.log(events.includes("tool_call:calc") ? "tool loop OK" : "WARNING: model did not call the tool");

  console.log("\nSmoke test finished.");
}

main().catch((err) => {
  if (err instanceof LlmUnavailableError) {
    console.error(err.message);
    process.exit(2);
  }
  console.error("\nSmoke test FAILED:", err);
  process.exit(1);
});
