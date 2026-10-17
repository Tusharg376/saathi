// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { addEntries, listEntries, watchEntries } from "./index";

// jsdom has no IndexedDB, which is the same situation as a browser that blocks it.

describe("on-device storage when the browser does not provide any", () => {
  it("refuses to save, with a message the screen can show", async () => {
    await expect(
      addEntries([
        { date: "2026-10-17", platform: "Swiggy", grossInr: 100, deductionsInr: 0, fuelInr: 0, otherCostInr: 0 },
      ]),
    ).rejects.toThrow("On-device storage is not available in this browser.");
  });

  it("refuses to list, rather than pretending there is nothing saved", async () => {
    await expect(listEntries()).rejects.toThrow("not available");
  });

  it("tells the watcher about the problem instead of crashing the page", async () => {
    const onChange = vi.fn();
    const onError = vi.fn();
    const stop = watchEntries(onChange, onError);
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(String(onError.mock.calls[0][0])).toContain("not available");
    expect(onChange).not.toHaveBeenCalled();
    stop();
  });

  it("does not need an error handler to stay quiet", async () => {
    const stop = watchEntries(vi.fn());
    await new Promise((r) => setTimeout(r, 20)); // nothing to throw, nothing to report
    stop();
  });
});
