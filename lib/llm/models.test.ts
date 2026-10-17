import { describe, expect, it } from "vitest";
import { usesDefaultSampling } from "./models";

describe("usesDefaultSampling", () => {
  it("is true for Gemini 3 and later, false for earlier models", () => {
    for (const id of ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3-pro", "gemini-4.0-flash", "gemini-10-x"]) {
      expect(usesDefaultSampling(id), id).toBe(true);
    }
    for (const id of ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-pro", "some-other-model"]) {
      expect(usesDefaultSampling(id), id).toBe(false);
    }
  });
});
