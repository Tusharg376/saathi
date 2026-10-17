import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { clearHandoff, peekHandoff, setHandoff, useHandoff } from "@/lib/handoff";

afterEach(() => clearHandoff("chat"));

describe("useHandoff", () => {
  it("gives the screen what was handed over", () => {
    setHandoff("chat", { prompt: "hello" });
    const { result } = renderHook(() => useHandoff("chat"));
    expect(result.current).toEqual({ prompt: "hello" });
  });

  it("is undefined when nothing was handed over", () => {
    const { result } = renderHook(() => useHandoff("chat"));
    expect(result.current).toBeUndefined();
  });

  it("hands it over once: the screen keeps it, but it is gone from the store afterwards", () => {
    setHandoff("chat", { prompt: "hello" });
    const { result, rerender } = renderHook(() => useHandoff("chat"));
    rerender();
    expect(result.current).toEqual({ prompt: "hello" }); // the screen still has it
    expect(peekHandoff("chat")).toBeUndefined(); // a later visit will not
  });
});
