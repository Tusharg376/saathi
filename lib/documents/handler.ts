import { LlmError, LlmUnavailableError, generateJSON, hasApiKey, inlineData, type Part } from "../llm/gemini";
import { LANGUAGES } from "../i18n/messages";
import { json, readBody, tooMany } from "../server/http";
import { redactPII } from "../safety/pii";
import { DocumentInsight, DocumentRequest, buildDocumentPrompt, normalizeInsight } from "./insight";

const langName = (code: string) => LANGUAGES.find((l) => l.code === code)?.english ?? "Hindi";

/** Photo of a notice, challan, message or form in; plain-language explanation out. Nothing is stored. */
export async function handleDocument(request: Request): Promise<Response> {
  const limited = tooMany(request, "doc");
  if (limited) return limited;

  const body = await readBody(request, DocumentRequest);
  if (!body.ok) return body.res;
  const { image, note, lang } = body.data;

  if (!hasApiKey()) return json({ error: "no_key" }, 503);

  const parts: Part[] = [
    { text: note?.trim() ? `The worker asks: ${redactPII(note).text}` : "Explain this document to the worker." },
    inlineData(image.mimeType, image.data),
  ];

  try {
    const raw = await generateJSON([{ role: "user", parts }], DocumentInsight, {
      model: "primary",
      system: buildDocumentPrompt(langName(lang)),
      temperature: 0.2,
    });
    return json({ insight: normalizeInsight(raw) });
  } catch (err) {
    if (err instanceof LlmUnavailableError) return json({ error: "no_key" }, 503);
    if (err instanceof LlmError && err.status === 429) return json({ error: "rate_limited" }, 429);
    console.error("document handler failure:", redactPII(String((err as Error)?.message ?? err)).text);
    return json({ error: "llm_error" }, 502);
  }
}
