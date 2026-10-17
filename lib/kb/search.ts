import MiniSearch from "minisearch";
import { allEntries, allHelplines, getEntry, isVerified, type Helpline, type KbCategory, type KbEntry } from "./index";

/**
 * Keyword retrieval over a small, curated KB. No vector DB needed: ~30 entries,
 * and the model is told to search with English keywords. Romanized and native
 * script keywords in the data also let the LLM-free fallback work.
 */

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "am", "was", "do", "does", "did", "i", "me", "my", "we", "you", "your",
  "to", "of", "in", "on", "for", "and", "or", "it", "this", "that", "what", "how", "can", "get", "will",
  "about", "tell", "please", "kya", "hai", "hain", "ka", "ki", "ke", "ko", "se", "mein", "main", "mera",
  "mujhe", "kaise", "kab", "hota", "karun", "karna", "chahiye",
]);

interface Doc {
  id: string;
  title: string;
  keywords: string;
  body: string;
}

function processTerm(term: string): string | null {
  const t = term.normalize("NFC").toLowerCase();
  return STOPWORDS.has(t) ? null : t;
}

function toDoc(e: KbEntry): Doc {
  return {
    id: e.id,
    title: e.title,
    keywords: e.keywords.join(" "),
    body: [e.summary, ...(e.eligibility ?? []), ...(e.benefits ?? []), ...(e.steps ?? [])].join(" "),
  };
}

let index: MiniSearch<Doc> | null = null;
function getIndex(): MiniSearch<Doc> {
  if (!index) {
    index = new MiniSearch<Doc>({
      fields: ["title", "keywords", "body"],
      storeFields: ["id"],
      processTerm,
      searchOptions: { boost: { keywords: 3, title: 2 }, prefix: true, fuzzy: 0.2, combineWith: "OR", processTerm },
    });
    index.addAll(allEntries().map(toDoc));
  }
  return index;
}

export interface SearchHit {
  entry: KbEntry;
  score: number;
}

export interface SearchOptions {
  category?: KbCategory;
  limit?: number;
  /** Worker's state. Entries specific to other states are down-ranked, not hidden. */
  state?: string;
}

/** The worker's own state's laws are boosted; other states' are down-ranked but not hidden. */
function stateAdjusted(score: number, entry: KbEntry, state?: string): number {
  if (!state || !entry.states?.length) return score;
  const mine = entry.states.some((s) => s.toLowerCase() === state.toLowerCase());
  return score * (mine ? 1.5 : 0.4);
}

export function searchKb(query: string, opts: SearchOptions = {}): SearchHit[] {
  const { category, limit = 4, state } = opts;
  if (!query.trim()) return [];

  const hits: SearchHit[] = [];
  for (const r of getIndex().search(query)) {
    const entry = getEntry(r.id as string);
    if (!entry || (category && entry.category !== category)) continue;
    hits.push({ entry, score: stateAdjusted(r.score, entry, state) });
  }
  hits.sort((a, b) => b.score - a.score);

  // Drop weak tail matches: a pension question should not list a state law that mentions
  // pensions in passing. Measured gap: noise scores 0.04-0.35 of the top hit, useful
  // secondary hits start near 0.55.
  const floor = (hits[0]?.score ?? 0) * RELATIVE_SCORE_FLOOR;
  return hits.filter((h) => h.score >= floor).slice(0, limit);
}

const RELATIVE_SCORE_FLOOR = 0.4;

/** The shape the model sees. Always carries status and verification so answers can be honest. */
export function compactForModel(e: KbEntry) {
  return {
    id: e.id,
    title: e.title,
    summary: e.summary,
    status: e.status,
    status_note: e.status_note,
    eligibility: e.eligibility,
    benefits: e.benefits,
    how_to_apply: e.how_to_apply,
    documents_needed: e.documents_needed,
    steps: e.steps,
    helpline: e.helpline,
    states: e.states,
    source_url: e.source_url,
    verified_by_human: isVerified(e),
    last_verified: e.last_verified,
  };
}

export function findHelplines(query: string, limit = 3): Helpline[] {
  const tokens = query
    .normalize("NFC")
    .toLowerCase()
    .split(/[\s,.;:!?()-]+/)
    .filter((t) => t && !STOPWORDS.has(t));
  const scored = allHelplines().map((h) => {
    const hay = [h.name, h.purpose, ...h.keywords].join(" ").toLowerCase();
    const score = tokens.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0);
    return { h, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.h);
}
