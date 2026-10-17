import { z } from "zod";
import { defineTool, type ToolDef } from "../llm/gemini";
import { checkEligibility, type WorkerProfile } from "../eligibility/engine";
import { compactForModel, findHelplines, searchKb } from "../kb/search";
import { getEntry } from "../kb";
import { PROPOSE_COMPLAINT, PROPOSE_EARNING, ProposeComplaintArgs, ProposeEarningArgs } from "./actions";

/**
 * Tools the model can call. All server-run and side-effect free: they only read
 * the curated KB or run deterministic rules. The model explains results; it
 * never decides them.
 */

const WorkerType = z.enum(["delivery", "cab_driver", "construction", "domestic", "street_vendor", "other"]);

const EligibilityArgs = z.object({
  age: z.number().int().min(0).max(120).optional().describe("Worker's age in years"),
  state: z.string().optional().describe("Indian state the worker works in, e.g. Karnataka"),
  workerType: WorkerType.optional(),
  isPlatformWorker: z.boolean().optional().describe("Works through an app or platform (Swiggy, Zomato, Uber, Ola, Rapido...)"),
  monthlyIncomeInr: z.number().min(0).optional().describe("Approximate monthly income in rupees"),
  isIncomeTaxPayer: z.boolean().optional(),
  inEpfoOrEsic: z.boolean().optional().describe("Member of EPFO (PF) or ESIC"),
  hasBankAccount: z.boolean().optional(),
  hasEshram: z.boolean().optional().describe("Already registered on e-Shram"),
  schemeIds: z.array(z.string()).optional().describe("Optional: only check these KB ids, e.g. scheme.pmsym"),
});

/** What the model hears back after proposing something. It must not claim the proposal was carried out. */
const PROPOSAL_SHOWN = {
  shown_to_worker: true,
  instruction: "A card is now on the worker's screen. Tell them they can check it there. NEVER say it is already saved or sent.",
};

/**
 * @param profile what the worker saved in the app. Facts the worker states in
 * chat (tool args) win over the saved profile, because they are more recent.
 */
export function buildTools(profile: WorkerProfile = {}): ToolDef[] {
  return [
    defineTool({
      name: "search_kb",
      description:
        "Search the curated knowledge base of welfare schemes, worker rights, safety advice and complaint routes. ALWAYS call this before stating any fact about schemes, laws, rights or documents. Use short English keywords, e.g. 'pension', 'id blocked', 'accident insurance'.",
      args: z.object({
        query: z.string().min(2).describe("Short English keywords"),
        category: z.enum(["scheme", "right", "safety"]).optional(),
      }),
      run: ({ query, category }) => {
        const hits = searchKb(query, { category, state: profile.state, limit: 3 });
        if (hits.length === 0) {
          return { results: [], note: "Nothing relevant found. Do not guess. Say you are not sure and call lookup_helpline." };
        }
        return { results: hits.map((h) => compactForModel(h.entry)) };
      },
    }),

    defineTool({
      name: "check_scheme_eligibility",
      description:
        "Screen the worker against the rules of central schemes and their state's gig-worker law. Pass only facts the worker actually told you. The result says likely / maybe / not_eligible and which facts are missing. Ask the worker for ONE missing fact at a time.",
      args: EligibilityArgs,
      run: ({ schemeIds, ...facts }) => {
        const merged: WorkerProfile = { ...profile, ...stripUndefined(facts) };
        const report = checkEligibility(merged, schemeIds);
        return {
          results: report.results.map((r) => ({
            ...r,
            source_url: getEntry(r.schemeId)?.source_url,
          })),
          ask_next: report.hints[0],
        };
      },
    }),

    defineTool({
      name: "lookup_helpline",
      description:
        "Find the right helpline for a situation (accident, harassment, cyber fraud, e-Shram help, legal aid...). Use when the knowledge base has no answer or when a call is the best next step.",
      args: z.object({ situation: z.string().min(2).describe("Short English description, e.g. 'online payment fraud'") }),
      run: ({ situation }) => {
        const hits = findHelplines(situation, 3);
        if (hits.length === 0) {
          return { helplines: [{ name: "Emergency", number: "112", purpose: "Police, fire, ambulance" }] };
        }
        return { helplines: hits.map((h) => ({ name: h.name, number: h.number, purpose: h.purpose, available: h.available })) };
      },
    }),

    defineTool({
      name: PROPOSE_EARNING,
      description:
        "Offer to save an earnings record the worker just described (for example 'aaj Swiggy pe 1850 mile'). This saves NOTHING: the worker checks and saves it on screen. Use only amounts the worker actually stated.",
      args: ProposeEarningArgs,
      clientAction: true,
      run: () => PROPOSAL_SHOWN,
    }),

    defineTool({
      name: PROPOSE_COMPLAINT,
      description:
        "After helping, offer to write a complaint letter when the worker describes a real problem with a platform, employer, contractor or challan (blocked ID, unpaid money, wrong penalty, harassment). This sends NOTHING: it opens a form the worker fills in. Do not use it for general questions.",
      args: ProposeComplaintArgs,
      clientAction: true,
      run: () => PROPOSAL_SHOWN,
    }),
  ];
}

function stripUndefined<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** KB entry ids that a tool result grounds the answer on (for the UI's "Sources"). */
export function sourceIdsFrom(toolName: string, result: unknown): string[] {
  const rows = (result as { results?: unknown } | undefined)?.results;
  // A malformed result must never break the chat stream, so check the shape instead of trusting it.
  if (!Array.isArray(rows)) return [];
  if (toolName === "search_kb") {
    return rows.map((x) => (x as { id?: string })?.id).filter((x): x is string => typeof x === "string");
  }
  if (toolName === "check_scheme_eligibility") {
    // Only cite schemes the worker could plausibly use, not every "not_eligible" row.
    return (rows as { schemeId?: string; verdict?: string }[])
      .filter((x) => typeof x?.schemeId === "string" && x.verdict !== "not_eligible")
      .slice(0, 3)
      .map((x) => x.schemeId as string);
  }
  return [];
}
