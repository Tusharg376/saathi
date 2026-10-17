import { describe, expect, it } from "vitest";
import { allEntries, allHelplines, getEntry, isVerified } from "./index";
import { compactForModel, findHelplines, searchKb } from "./search";
import { RULES } from "../eligibility/engine";

describe("KB integrity", () => {
  const entries = allEntries();

  it("has unique ids", () => {
    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("id prefix matches category", () => {
    const prefix: Record<string, string> = { scheme: "scheme", right: "right", safety: "safety", grievance: "grievance", document: "document" };
    for (const e of entries) expect(e.id.startsWith(prefix[e.category] + "."), e.id).toBe(true);
  });

  it("every non-live entry explains what is uncertain", () => {
    for (const e of entries) {
      if (e.status !== "live") expect(e.status_note, `${e.id} needs status_note`).toBeTruthy();
    }
  });

  it("state-specific gig acts name their state", () => {
    for (const e of entries.filter((x) => x.id.startsWith("right.gig_act_"))) {
      expect(e.states?.length, e.id).toBeGreaterThan(0);
    }
  });

  it("sources are https and verification dates are ISO or null", () => {
    for (const e of entries) {
      expect(e.source_url.startsWith("https://"), e.id).toBe(true);
      if (e.last_verified !== null) expect(e.last_verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("entries marked researched record the date", () => {
    for (const e of entries.filter((x) => x.confidence === "researched")) {
      expect(e.researched_on, e.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("announced benefits are never presented as live", () => {
    for (const e of entries.filter((x) => x.id === "scheme.pmjay_gig")) expect(e.status).toBe("announced");
  });

  it("eligibility rules only reference real KB entries", () => {
    for (const id of Object.keys(RULES)) expect(getEntry(id), id).toBeDefined();
  });

  it("helplines are well formed with unique ids", () => {
    const hs = allHelplines();
    expect(new Set(hs.map((h) => h.id)).size).toBe(hs.length);
    for (const h of hs) expect(h.number).toMatch(/^\d{3,5}$/);
  });
});

describe("KB search recall", () => {
  const cases: [string, string][] = [
    ["pension", "scheme.pmsym"],
    ["old age pension for workers", "scheme.pmsym"],
    ["e-shram card", "scheme.eshram"],
    ["how to register labour card", "scheme.eshram"],
    ["accident insurance", "scheme.pmsby"],
    ["life insurance", "scheme.pmjjby"],
    ["ration card migrant", "scheme.onorc"],
    ["street vendor loan", "scheme.pmsvanidhi"],
    ["construction worker welfare board", "scheme.bocw"],
    ["my id got blocked", "right.deactivation_id_block"],
    ["mera ID block ho gaya", "right.deactivation_id_block"],
    ["account deactivated by platform", "right.deactivation_id_block"],
    ["contractor not paid my wages", "right.wages_on_time"],
    ["chalan", "right.challan_contest"],
    ["free lawyer", "right.legal_aid"],
    ["OTP scam", "safety.scam_fraud"],
    ["heat stroke", "safety.heat"],
    ["angry customer", "safety.customer_conflict"],
    ["night shift safety", "safety.night_shift"],
    ["what to do after accident", "safety.accident_steps"],
    // romanized and native-script keywords power the LLM-free fallback
    ["पेंशन", "scheme.pmsym"],
    ["ई-श्रम कार्ड", "scheme.eshram"],
    ["आईडी ब्लॉक", "right.deactivation_id_block"],
    ["चालान", "right.challan_contest"],
  ];

  for (const [query, expected] of cases) {
    it(`"${query}" finds ${expected} in top 3`, () => {
      const ids = searchKb(query, { limit: 3 }).map((h) => h.entry.id);
      expect(ids).toContain(expected);
    });
  }

  it("ranks the worker's own state's gig law first", () => {
    const top = searchKb("gig worker law welfare board", { state: "Karnataka", limit: 1 })[0];
    expect(top.entry.id).toBe("right.gig_act_karnataka");
    const topBihar = searchKb("gig worker law welfare board", { state: "Bihar", limit: 1 })[0];
    expect(topBihar.entry.id).toBe("right.gig_act_bihar");
  });

  it("drops weak tail matches so a pension question is not padded with unrelated laws", () => {
    const ids = searchKb("pension kaise milegi", { limit: 5 }).map((h) => h.entry.id);
    expect(ids).toEqual(["scheme.pmsym"]);
    expect(searchKb("my id got blocked", { limit: 5 }).map((h) => h.entry.id)).not.toContain("scheme.pmjay_gig");
  });

  it("keeps genuinely related secondary hits", () => {
    const ids = searchKb("accident insurance", { limit: 5 }).map((h) => h.entry.id);
    expect(ids[0]).toBe("scheme.pmsby");
    expect(ids.slice(0, 3)).toContain("safety.accident_steps");
  });

  it("filters by category", () => {
    const hits = searchKb("accident", { category: "safety", limit: 5 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.entry.category === "safety")).toBe(true);
  });

  it("returns nothing for empty or stopword-only queries", () => {
    expect(searchKb("")).toEqual([]);
    expect(searchKb("   ")).toEqual([]);
    expect(searchKb("what is the")).toEqual([]);
  });

  it("model-facing view carries status and verification so answers stay honest", () => {
    const e = getEntry("scheme.pmjay_gig")!;
    const view = compactForModel(e);
    expect(view.status).toBe("announced");
    expect(view.status_note).toBeTruthy();
    expect(view.verified_by_human).toBe(isVerified(e));
  });

  it("finds helplines by situation", () => {
    expect(findHelplines("accident injured").map((h) => h.id)).toContain("ambulance_108");
    expect(findHelplines("upi fraud money lost").map((h) => h.id)).toContain("cyber_1930");
    expect(findHelplines("harassment").map((h) => h.id)).toContain("women_181");
  });
});
