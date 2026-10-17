import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setPref, usePref } from "./store";

function Readout({ name }: { name: "largeText" | "autoRead" }) {
  return <p data-testid={name}>{usePref(name) ? "on" : "off"}</p>;
}

afterEach(() => {
  vi.restoreAllMocks();
  act(() => {
    setPref("largeText", false);
    setPref("autoRead", false);
  });
});

describe("preferences on this phone", () => {
  it("remembers a switch across visits by saving it on the device", () => {
    act(() => setPref("autoRead", true));
    expect(localStorage.getItem("saathi.pref.autoRead")).toBe("1");
    act(() => setPref("autoRead", false));
    expect(localStorage.getItem("saathi.pref.autoRead")).toBe("0");
  });

  it("updates every screen showing the setting at once", () => {
    render(
      <>
        <Readout name="largeText" />
        <Readout name="autoRead" />
      </>,
    );
    expect(screen.getByTestId("largeText")).toHaveTextContent("off");

    act(() => setPref("largeText", true));

    expect(screen.getByTestId("largeText")).toHaveTextContent("on");
    expect(screen.getByTestId("autoRead")).toHaveTextContent("off"); // the other switch is untouched
  });

  it("still works for this visit when the phone blocks saving (private mode), and says nothing scary", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    render(<Readout name="autoRead" />);
    expect(screen.getByTestId("autoRead")).toHaveTextContent("off");

    expect(() => act(() => setPref("autoRead", true))).not.toThrow();

    expect(screen.getByTestId("autoRead")).toHaveTextContent("on");
  });

  it("stops listening when the screen goes away", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<Readout name="largeText" />);
    unmount();
    expect(remove).toHaveBeenCalledWith("saathi-prefs-change", expect.any(Function));
    expect(remove).toHaveBeenCalledWith("storage", expect.any(Function));
  });
});
