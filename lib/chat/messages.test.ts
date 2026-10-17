import { describe, expect, it } from "vitest";
import type { ChatEvent } from "../agent/events";
import { MAX_HISTORY, applyEvent, localEmergency, toHistory, type Msg } from "./messages";

const bot = (over: Partial<Msg> = {}): Msg => ({ id: "a1", role: "assistant", text: "", streaming: true, ...over });
const fold = (events: ChatEvent[], start: Msg = bot()) => events.reduce(applyEvent, start);

describe("applyEvent", () => {
  it("builds the answer from streamed text and clears the 'working' line once words arrive", () => {
    const m = fold([{ type: "tool", name: "search_kb" }, { type: "text", text: "PM-SYM " }, { type: "text", text: "is a pension." }]);
    expect(m.text).toBe("PM-SYM is a pension.");
    expect(m.tool).toBeUndefined();
  });

  it("shows which tool is running until text arrives", () => {
    expect(fold([{ type: "tool", name: "check_scheme_eligibility" }]).tool).toBe("check_scheme_eligibility");
  });

  it("records sources, fallback ids, the PII notice and errors", () => {
    const m = fold([
      { type: "sources", ids: ["scheme.pmsym"] },
      { type: "fallback", ids: ["scheme.eshram"] },
      { type: "notice", code: "pii_redacted", found: ["PHONE"] },
      { type: "error", code: "no_key", message: "x" },
    ]);
    expect(m).toMatchObject({ sources: ["scheme.pmsym"], fallback: ["scheme.eshram"], piiHidden: true, error: "no_key" });
  });

  it("collects proposed actions in order", () => {
    const entry = { date: "2026-10-17", platform: "Swiggy", grossInr: 1, deductionsInr: 0, fuelInr: 0, otherCostInr: 0 };
    const m = fold([
      { type: "action", action: { kind: "log_earning", entry } },
      { type: "action", action: { kind: "start_complaint", issue: "penalty", summary: "They cut my pay wrongly." } },
    ]);
    expect(m.actions?.map((a) => a.kind)).toEqual(["log_earning", "start_complaint"]);
  });

  it("never downgrades an urgent emergency to a mere possibility", () => {
    const urgent: ChatEvent = { type: "emergency", severity: "urgent", kinds: ["medical"], helplines: ["ambulance_108"] };
    const possible: ChatEvent = { type: "emergency", severity: "possible", kinds: ["medical"], helplines: ["emergency_112"] };
    expect(fold([urgent, possible]).emergency?.severity).toBe("urgent");
    expect(fold([possible, urgent]).emergency?.severity).toBe("urgent");
    expect(fold([possible]).emergency).toEqual({ severity: "possible", helplines: ["emergency_112"] });
  });

  it("an on-device emergency already on the message survives a weaker server verdict", () => {
    const start = bot({ emergency: { severity: "urgent", helplines: ["ambulance_108"] } });
    const m = fold([{ type: "emergency", severity: "possible", kinds: [], helplines: [] }], start);
    expect(m.emergency).toEqual({ severity: "urgent", helplines: ["ambulance_108"] });
  });

  it("'done' changes nothing, and the input message is never mutated", () => {
    const start = bot({ text: "hi" });
    const frozen = Object.freeze({ ...start });
    expect(applyEvent(frozen, { type: "done" })).toBe(frozen);
    expect(applyEvent(frozen, { type: "text", text: "!" }).text).toBe("hi!");
    expect(frozen.text).toBe("hi");
  });
});

describe("toHistory", () => {
  const u = (id: string, text: string): Msg => ({ id, role: "user", text });
  const a = (id: string, text: string, over: Partial<Msg> = {}): Msg => ({ id, role: "assistant", text, ...over });

  it("sends only real text, in order", () => {
    expect(toHistory([u("1", "hi"), a("2", "hello"), a("3", "   ")])).toEqual([
      { role: "user", text: "hi" },
      { role: "assistant", text: "hello" },
    ]);
  });
  it("leaves out failed turns", () => {
    expect(toHistory([u("1", "hi"), a("2", "partial", { error: "llm_error" })])).toEqual([{ role: "user", text: "hi" }]);
  });
  it("keeps only the most recent turns", () => {
    const many = Array.from({ length: 30 }, (_, i) => u(String(i), `m${i}`));
    const h = toHistory(many);
    expect(h).toHaveLength(MAX_HISTORY);
    expect(h.at(-1)?.text).toBe("m29");
  });
});

describe("localEmergency", () => {
  it("is available on the device with no network", () => {
    expect(localEmergency("accident ho gaya abhi, khoon beh raha hai")).toMatchObject({ severity: "urgent" });
    expect(localEmergency("accident ho gaya abhi, khoon beh raha hai")?.helplines).toContain("ambulance_108");
  });
  it("is undefined for an ordinary message", () => {
    expect(localEmergency("pension kaise milegi")).toBeUndefined();
    expect(localEmergency("accident insurance kaise milega")).toBeUndefined();
  });
});
