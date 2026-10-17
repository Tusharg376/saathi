import { describe, expect, it } from "vitest";
import { offlineAnswerIds } from "./offline";

describe("offlineAnswerIds", () => {
  it("answers from the bundled knowledge base with no network", async () => {
    expect(await offlineAnswerIds("accident ho gaya, ambulance")).toContain("safety.accident_steps");
    expect(await offlineAnswerIds("pension")).toContain("scheme.pmsym");
  });
  it("prefers the worker's own state's law", async () => {
    expect((await offlineAnswerIds("gig worker law welfare board", "Bihar"))[0]).toBe("right.gig_act_bihar");
  });
  it("returns nothing for a question the knowledge base cannot help with, instead of unrelated cards", async () => {
    expect(await offlineAnswerIds("zzzxqv")).toEqual([]);
  });
  it("returns at most three", async () => {
    expect((await offlineAnswerIds("worker")).length).toBeLessThanOrEqual(3);
  });
});
