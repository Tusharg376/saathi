import { describe, expect, it } from "vitest";
import { buildTools, sourceIdsFrom } from "./tools";
import { toJsonSchema } from "../llm/gemini";

const run = async (name: string, args: unknown, profile = {}) => {
  const tool = buildTools(profile).find((t) => t.name === name)!;
  const parsed = tool.args.parse(args);
  return (await tool.run(parsed)) as Record<string, unknown>;
};

describe("tool declarations", () => {
  it("every tool converts to a JSON schema object Gemini can accept", () => {
    for (const t of buildTools()) {
      const schema = toJsonSchema(t.args);
      expect(schema.type, t.name).toBe("object");
      expect(schema).not.toHaveProperty("$schema");
      expect(t.description.length, t.name).toBeGreaterThan(20);
    }
  });
});

describe("search_kb", () => {
  it("returns compact entries that carry status and verification", async () => {
    const r = (await run("search_kb", { query: "pension" })) as { results: Record<string, unknown>[] };
    expect(r.results.length).toBeGreaterThan(0);
    const first = r.results[0];
    expect(first.id).toBe("scheme.pmsym");
    expect(first).toHaveProperty("status");
    expect(first).toHaveProperty("verified_by_human");
    expect(first).toHaveProperty("source_url");
  });

  it("limits results to 3", async () => {
    const r = (await run("search_kb", { query: "worker" })) as { results: unknown[] };
    expect(r.results.length).toBeLessThanOrEqual(3);
  });

  it("tells the model not to guess when nothing matches", async () => {
    const r = (await run("search_kb", { query: "zzzxqv" })) as { results: unknown[]; note: string };
    expect(r.results).toEqual([]);
    expect(r.note).toMatch(/not guess/i);
  });

  it("uses the saved profile's state to rank that state's law first", async () => {
    const r = (await run("search_kb", { query: "gig worker law welfare board" }, { state: "Bihar" })) as {
      results: { id: string }[];
    };
    expect(r.results[0].id).toBe("right.gig_act_bihar");
  });

  it("announced benefits keep their 'announced' status in what the model sees", async () => {
    const r = (await run("search_kb", { query: "gig worker health cover budget" })) as {
      results: { id: string; status: string }[];
    };
    const gig = r.results.find((x) => x.id === "scheme.pmjay_gig");
    expect(gig?.status).toBe("announced");
  });
});

describe("check_scheme_eligibility", () => {
  it("merges the saved profile with facts stated in chat; chat wins", async () => {
    const profile = { age: 25, hasBankAccount: true };
    const r = (await run("check_scheme_eligibility", { schemeIds: ["scheme.pmjjby"] }, profile)) as {
      results: { verdict: string }[];
    };
    expect(r.results[0].verdict).toBe("likely");

    const older = (await run("check_scheme_eligibility", { age: 55, schemeIds: ["scheme.pmjjby"] }, profile)) as {
      results: { verdict: string }[];
    };
    expect(older.results[0].verdict).toBe("not_eligible");
  });

  it("asks for one missing fact at a time", async () => {
    const r = (await run("check_scheme_eligibility", { age: 30, schemeIds: ["scheme.pmsym"] })) as {
      ask_next?: string;
    };
    expect(r.ask_next).toMatch(/^Tell me /);
  });

  it("includes the official source for each result", async () => {
    const r = (await run("check_scheme_eligibility", { age: 30 })) as { results: { source_url?: string }[] };
    expect(r.results.every((x) => x.source_url?.startsWith("https://"))).toBe(true);
  });

  it("rejects out-of-range input at the schema, before running any rules", () => {
    const tool = buildTools().find((t) => t.name === "check_scheme_eligibility")!;
    expect(tool.args.safeParse({ age: 400 }).success).toBe(false);
    expect(tool.args.safeParse({ workerType: "astronaut" }).success).toBe(false);
  });
});

describe("lookup_helpline", () => {
  it("finds the right helpline", async () => {
    const r = (await run("lookup_helpline", { situation: "accident injured" })) as { helplines: { number: string }[] };
    expect(r.helplines.map((h) => h.number)).toContain("108");
  });

  it("falls back to 112 instead of inventing a number", async () => {
    const r = (await run("lookup_helpline", { situation: "zzzxqv" })) as { helplines: { number: string }[] };
    expect(r.helplines).toEqual([expect.objectContaining({ number: "112" })]);
  });
});

describe("sourceIdsFrom", () => {
  it("cites search results", () => {
    expect(sourceIdsFrom("search_kb", { results: [{ id: "a.b" }, { id: "c.d" }] })).toEqual(["a.b", "c.d"]);
  });

  it("cites only schemes the worker could actually use", () => {
    const ids = sourceIdsFrom("check_scheme_eligibility", {
      results: [
        { schemeId: "scheme.eshram", verdict: "likely" },
        { schemeId: "scheme.pmsym", verdict: "not_eligible" },
        { schemeId: "scheme.pmjay", verdict: "maybe" },
      ],
    });
    expect(ids).toEqual(["scheme.eshram", "scheme.pmjay"]);
  });

  it("ignores other tools and malformed results", () => {
    expect(sourceIdsFrom("lookup_helpline", { helplines: [] })).toEqual([]);
    expect(sourceIdsFrom("search_kb", undefined)).toEqual([]);
    expect(sourceIdsFrom("search_kb", { results: "nope" })).toEqual([]);
  });
});

describe("propose tools", () => {
  const proposes = buildTools().filter((t) => t.name.startsWith("propose_"));

  it("exist for earnings and complaints, and are client actions (the screen applies them)", () => {
    expect(proposes.map((t) => t.name).sort()).toEqual(["propose_complaint", "propose_log_earning"]);
    expect(proposes.every((t) => t.clientAction)).toBe(true);
  });

  it("save and send nothing, and tell the model not to claim they did", async () => {
    for (const t of proposes) {
      const out = (await t.run({})) as { shown_to_worker: boolean; instruction: string };
      expect(out.shown_to_worker).toBe(true);
      expect(out.instruction).toMatch(/NEVER say it is already saved or sent/);
    }
  });

  it("say in their descriptions that nothing is saved or sent", () => {
    for (const t of proposes) expect(t.description).toMatch(/saves NOTHING|sends NOTHING/);
  });
});
