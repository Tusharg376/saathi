// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./share";

const LETTER = "Dear Sir,\nPlease return the Rs 400 deducted on 14 October.";

function clipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
}

/** The old copy command: records what the hidden text box held at the moment of copying. */
function oldCopyCommand(result: boolean | "throws") {
  const seen: { value: string; readOnly: boolean }[] = [];
  document.execCommand = vi.fn(() => {
    const box = document.querySelector("textarea");
    if (box) seen.push({ value: box.value, readOnly: box.hasAttribute("readonly") });
    if (result === "throws") throw new Error("not allowed");
    return result;
  });
  return seen;
}

afterEach(() => {
  delete (navigator as { clipboard?: unknown }).clipboard;
  delete (document as { execCommand?: unknown }).execCommand;
});

describe("copyText", () => {
  it("copies with the browser clipboard when it is available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    clipboard(writeText);
    expect(await copyText(LETTER)).toBe(true);
    expect(writeText).toHaveBeenCalledWith(LETTER);
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("falls back to the old copy command when the clipboard refuses permission", async () => {
    clipboard(() => Promise.reject(new DOMException("denied", "NotAllowedError")));
    const seen = oldCopyCommand(true);
    expect(await copyText(LETTER)).toBe(true);
    expect(seen).toEqual([{ value: LETTER, readOnly: true }]);
  });

  it("falls back too on a page without a clipboard at all, such as a test phone on a LAN address", async () => {
    const seen = oldCopyCommand(true);
    expect(await copyText(LETTER)).toBe(true);
    expect(seen[0].value).toBe(LETTER);
  });

  it("never leaves its hidden text box behind, whether copying worked or not", async () => {
    oldCopyCommand(true);
    await copyText(LETTER);
    expect(document.querySelector("textarea")).toBeNull();
    oldCopyCommand(false);
    await copyText(LETTER);
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("says it failed when the old command reports failure, so no one is told 'Copied' falsely", async () => {
    oldCopyCommand(false);
    expect(await copyText(LETTER)).toBe(false);
  });

  it("says it failed, and does not crash, when the browser has no way to copy", async () => {
    oldCopyCommand("throws");
    expect(await copyText(LETTER)).toBe(false);
  });
});
