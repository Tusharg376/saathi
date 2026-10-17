import { afterEach, describe, expect, it, vi } from "vitest";
import { HANDOFF_TTL_MS, clearHandoff, peekHandoff, setHandoff } from "./handoff";

afterEach(() => {
  clearHandoff("chat");
  clearHandoff("complaint");
  clearHandoff("earnings");
  vi.restoreAllMocks();
});

describe("handoff", () => {
  it("carries a payload to the screen it is for", () => {
    setHandoff("chat", { prompt: "hello" });
    expect(peekHandoff("chat")).toEqual({ prompt: "hello" });
  });

  it("keeps each screen's payload separate", () => {
    setHandoff("chat", { prompt: "a" });
    setHandoff("complaint", { issue: "penalty" });
    expect(peekHandoff("complaint")).toEqual({ issue: "penalty" });
    expect(peekHandoff("earnings")).toBeUndefined();
  });

  it("can be read more than once, so a double render sees the same thing", () => {
    setHandoff("chat", { prompt: "hello" });
    expect(peekHandoff("chat")).toEqual(peekHandoff("chat"));
  });

  it("is gone once cleared", () => {
    setHandoff("chat", { prompt: "hello" });
    clearHandoff("chat");
    expect(peekHandoff("chat")).toBeUndefined();
  });

  it("goes stale: a handoff nobody picked up must not surprise a later visit", () => {
    setHandoff("chat", { prompt: "hello" }, 1_000);
    expect(peekHandoff("chat", 1_000 + HANDOFF_TTL_MS)).toEqual({ prompt: "hello" });
    expect(peekHandoff("chat", 1_000 + HANDOFF_TTL_MS + 1)).toBeUndefined();
    expect(peekHandoff("chat", 1_000)).toBeUndefined(); // and it was dropped, not just hidden
  });

  it("does not read the clock when nothing is waiting, because Next.js refuses to prerender a page that does", () => {
    const now = vi.spyOn(Date, "now");
    expect(peekHandoff("earnings")).toBeUndefined();
    expect(now).not.toHaveBeenCalled();
  });
});
