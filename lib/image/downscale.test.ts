import { describe, expect, it } from "vitest";
import { fitWithin } from "./downscale";

describe("fitWithin", () => {
  it("shrinks the longest edge to the limit and keeps the aspect ratio", () => {
    expect(fitWithin(4000, 3000, 1280)).toEqual({ width: 1280, height: 960 });
    expect(fitWithin(3000, 4000, 1280)).toEqual({ width: 960, height: 1280 });
  });

  it("never upscales a small image", () => {
    expect(fitWithin(800, 600, 1280)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1280, 1280, 1280)).toEqual({ width: 1280, height: 1280 });
  });

  it("handles very thin images without collapsing to zero", () => {
    const r = fitWithin(20000, 1, 1280);
    expect(r.width).toBe(1280);
    expect(r.height).toBe(1);
  });

  it("handles a typical 50MP phone photo", () => {
    expect(fitWithin(8160, 6120, 1280)).toEqual({ width: 1280, height: 960 });
  });
});
