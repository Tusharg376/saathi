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
