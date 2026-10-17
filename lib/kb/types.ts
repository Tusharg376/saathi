import type { z } from "zod";
import type {
  Helpline as HelplineSchema,
  KbCategory as KbCategorySchema,
  KbEntry as KbEntrySchema,
  KbStatus as KbStatusSchema,
} from "./schema";

/**
 * Plain types for the knowledge base, derived from the schema in ./schema but erased at build time,
 * so importing them costs the browser nothing.
 *
 *  live            - operating now
 *  rolling_out     - law/scheme exists, implementation is partial or in progress
 *  announced       - announced by government, not confirmed as operating
 *  state_specific  - depends on the worker's state
 */
export type KbStatus = z.infer<typeof KbStatusSchema>;
export type KbCategory = z.infer<typeof KbCategorySchema>;
export type KbEntry = z.infer<typeof KbEntrySchema>;
export type Helpline = z.infer<typeof HelplineSchema>;
