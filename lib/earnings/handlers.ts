import { LlmError, LlmUnavailableError, generateJSON, generateText, hasApiKey, inlineData, userText, type Part } from "../llm/gemini";
import { LANGUAGES } from "../i18n/messages";
import { json, readBody, tooMany } from "../server/http";
import { redactPII } from "../safety/pii";
import { buildInsightInput, buildInsightPrompt } from "./insight";
import { InsightRequest, ParseRequest, ParseResult, buildParsePrompt, normalizeParsed } from "./parse";

const langName = (code: string) => LANGUAGES.find((l) => l.code === code)?.english ?? "Hindi";

/** Never leak provider error text to the worker; map to a small set of codes. */
function failure(err: unknown): Response {
  if (err instanceof LlmUnavailableError) return json({ error: "no_key" }, 503);
  if (err instanceof LlmError && err.status === 429) return json({ error: "rate_limited" }, 429);
  console.error("earnings handler failure:", redactPII(String((err as Error)?.message ?? err)).text);
  return json({ error: "llm_error" }, 502);
}

/** Text or screenshot -> structured entries for the worker to confirm. Nothing is saved here. */
export async function handleParse(request: Request): Promise<Response> {
  const limited = tooMany(request, "earn-parse");
  if (limited) return limited;

  const body = await readBody(request, ParseRequest);
  if (!body.ok) return body.res;
  const { text, image, lang, today } = body.data;

  if (!hasApiKey()) return json({ error: "no_key" }, 503);

  const parts: Part[] = [{ text: text?.trim() ? redactPII(text).text : "Extract the earnings shown in this screenshot." }];
  if (image) parts.push(inlineData(image.mimeType, image.data));

  try {
    const result = await generateJSON([{ role: "user", parts }], ParseResult, {
      model: "primary",
      system: buildParsePrompt(today, langName(lang)),
      temperature: 0,
    });
    return json(normalizeParsed(result, today));
  } catch (err) {
    return failure(err);
  }
}

/** Aggregates in, a short plain-language explanation out. */
export async function handleInsight(request: Request): Promise<Response> {
  const limited = tooMany(request, "earn-insight");
  if (limited) return limited;

  const body = await readBody(request, InsightRequest);
  if (!body.ok) return body.res;

  if (!hasApiKey()) return json({ error: "no_key" }, 503);

  try {
    const text = await generateText([userText(buildInsightInput(body.data))], {
      model: "primary",
      system: buildInsightPrompt(langName(body.data.lang)),
      temperature: 0.3,
    });
    const clean = text.trim();
    if (!clean) return json({ error: "llm_error" }, 502);
    return json({ text: clean });
  } catch (err) {
    return failure(err);
  }
}
