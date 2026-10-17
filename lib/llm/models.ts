/**
 * Model ids live in one place and can be overridden from the environment,
 * because Gemini model names change often.
 *
 * PRIMARY: chat, reasoning, vision, drafting (quality matters, esp. Indic languages)
 * FAST:    classification, routing, transcription (cheap and quick)
 */
export const MODELS = {
  get primary() {
    return process.env.GEMINI_MODEL_PRIMARY || "gemini-3.8-flash";
  },
  get fast() {
    return process.env.GEMINI_MODEL_FAST || "gemini-3.5-flash-lite";
  },
} as const;

export type ModelTier = "primary" | "fast";

export function resolveModel(tier: ModelTier | string | undefined): string {
  if (!tier || tier === "primary") return MODELS.primary;
  if (tier === "fast") return MODELS.fast;
  return tier; // explicit model id
}

/**
 * Gemini 3 models are tuned for their default sampling, and Google advises against lowering the temperature
 * (it can make them loop or reason worse). Later versions ignore a custom value altogether. So for these
 * models the app asks for a value and the adapter simply does not send it.
 */
export const usesDefaultSampling = (model: string): boolean => /^gemini-(?:[3-9]|\d{2,})/.test(model);
