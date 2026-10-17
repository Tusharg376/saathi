import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setPref } from "@/lib/prefs/store";
import { PrefsEffects } from "./PrefsEffects";

const textSize = () => document.documentElement.dataset.text;

afterEach(() => vi.restoreAllMocks());

describe("PrefsEffects (display preferences)", () => {
  it("uses normal text size until the worker asks for bigger", () => {
    render(<PrefsEffects />);
    expect(textSize()).toBe("normal");
  });

  it("makes the whole page use large text when the worker turned it on earlier", () => {
    // Tests run in order: nothing above has touched the switch, so this is a fresh visit.
    localStorage.setItem("saathi.pref.largeText", "1");
    render(<PrefsEffects />);
    expect(textSize()).toBe("large");
  });

  it("changes the page the moment the switch is flipped, and back again", () => {
    render(<PrefsEffects />);
    act(() => setPref("largeText", true));
    expect(textSize()).toBe("large");
    act(() => setPref("largeText", false));
    expect(textSize()).toBe("normal");
  });

  it("still enlarges the text for this visit when the phone will not let the app save settings", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    act(() => setPref("largeText", false));
    render(<PrefsEffects />);
    expect(() => act(() => setPref("largeText", true))).not.toThrow();
    expect(textSize()).toBe("large");
  });

  it("renders nothing visible", () => {
    const { container } = render(<PrefsEffects />);
    expect(container).toBeEmptyDOMElement();
  });
});
