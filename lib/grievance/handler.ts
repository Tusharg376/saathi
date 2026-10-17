import { generateJSON, hasApiKey, userText } from "../llm/gemini";
import { json, readBody, tooMany } from "../server/http";
import { languageName, llmFailure } from "../server/llm-response";
import { GrievanceDraft, GrievanceRequest, buildGrievanceInput, buildGrievancePrompt, normalizeDraft } from "./draft";

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
    langName: languageName(req.lang),
    letterLangName: req.letterLang === "en" ? "English" : languageName(req.lang),
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
    return llmFailure("grievance handler", err);
  }
}
