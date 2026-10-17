import { z } from "zod";

/**
 * How available a benefit or protection is in practice.
 *  live            - operating now
 *  rolling_out     - law/scheme exists, implementation is partial or in progress
 *  announced       - announced by government, not confirmed as operating
 *  state_specific  - depends on the worker's state
 */
export const KbStatus = z.enum(["live", "rolling_out", "announced", "state_specific"]);
export type KbStatus = z.infer<typeof KbStatus>;

export const KbCategory = z.enum(["scheme", "right", "safety", "grievance", "document"]);
export type KbCategory = z.infer<typeof KbCategory>;

export const KbEntry = z.object({
  id: z.string().regex(/^[a-z]+\.[a-z0-9_]+$/, "id must look like scheme.eshram"),
  category: KbCategory,
  title: z.string().min(3),
  /** Plain English, 1-3 sentences. The model rewrites it in the worker's language. */
  summary: z.string().min(20),
  /** English plus romanized and native-script terms, so retrieval works without the LLM. */
  keywords: z.array(z.string()).min(3),
  eligibility: z.array(z.string()).optional(),
  benefits: z.array(z.string()).optional(),
  how_to_apply: z.array(z.string()).optional(),
  documents_needed: z.array(z.string()).optional(),
  /** Ordered do/don't steps (safety entries). */
  steps: z.array(z.string()).optional(),
  status: KbStatus,
  /** What is uncertain or still unfolding. Required whenever status is not "live". */
  status_note: z.string().optional(),
  states: z.array(z.string()).optional(),
  helpline: z.string().optional(),
  source_url: z.url(),
  /**
   * ISO date a human or scripts/verify-kb.ts last confirmed this against the
   * official source. null = not yet verified (every entry starts null).
   */
  last_verified: z.string().nullable(),
  /**
   * researched: checked against web sources on the date in `researched_on`
   *             (secondary sources, still needs official confirmation)
   * recalled:   written from general knowledge; verify first
   */
  confidence: z.enum(["researched", "recalled"]),
  researched_on: z.string().optional(),
});
export type KbEntry = z.infer<typeof KbEntry>;

export const Helpline = z.object({
  id: z.string(),
  name: z.string(),
  number: z.string(),
  purpose: z.string(),
  /** Keywords for matching a situation to this helpline. */
  keywords: z.array(z.string()),
  available: z.string(),
  source_url: z.url(),
});
export type Helpline = z.infer<typeof Helpline>;
