import { LlmError, LlmUnavailableError, generateJSON, hasApiKey, userText } from "../llm/gemini";
import { LANGUAGES } from "../i18n/messages";
import { json, readBody, tooMany } from "../server/http";
import { redactPII } from "../safety/pii";
import { GrievanceDraft, GrievanceRequest, buildGrievanceInput, buildGrievancePrompt, normalizeDraft } from "./draft";

const langName = (code: string) => LANGUAGES.find((l) => l.code === code)?.english ?? "Hindi";

/**
 * Describes a problem, returns either a few follow-up questions or a complete letter.
 * The worker's name and phone are never sent: the model writes placeholders and the
 * device fills them in. On no key or failure the client falls back to a template letter.
 */
export async function handleGrievance(request: Request): Promise<Response> {
  const limited = tooMany(request, "grv");
  if (limited) return limited;

  const body = await readBody(request, GrievanceRequest);
  if (!body.ok) return body.res;
  const req = body.data;

  if (!hasApiKey()) return json({ error: "no_key" }, 503);

  const final = Boolean(req.final);
  const system = buildGrievancePrompt({
    issue: req.issue,
    langName: langName(req.lang),
    letterLangName: req.letterLang === "en" ? "English" : langName(req.lang),
    final,
  });

  try {
    const raw = await generateJSON([userText(buildGrievanceInput(req))], GrievanceDraft, {
      model: "primary",
      system,
      temperature: 0.3,
    });
    const draft = normalizeDraft(raw, final);
    if (!draft) return json({ error: "llm_error" }, 502);
    return json({ draft });
  } catch (err) {
    if (err instanceof LlmUnavailableError) return json({ error: "no_key" }, 503);
    if (err instanceof LlmError && err.status === 429) return json({ error: "rate_limited" }, 429);
    console.error("grievance handler failure:", redactPII(String((err as Error)?.message ?? err)).text);
    return json({ error: "llm_error" }, 502);
  }
}
