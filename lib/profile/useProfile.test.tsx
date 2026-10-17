import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { saveProfile, useProfile } from "./store";

function Readout() {
  const profile = useProfile();
  return <p data-testid="profile">{JSON.stringify(profile)}</p>;
}
const shown = () => JSON.parse(screen.getByTestId("profile").textContent!);

afterEach(() => vi.restoreAllMocks());

describe("useProfile: what the worker told Saathi about themselves", () => {
  it("starts empty for a worker who has told us nothing", () => {
    render(<Readout />);
    expect(shown()).toEqual({});
  });

  it("shows the saved profile, and every screen using it updates the moment it is saved", () => {
    render(
      <>
        <Readout />
        <Readout />
      </>,
    );
    act(() => saveProfile({ age: 31, state: "Bihar" }));
    for (const el of screen.getAllByTestId("profile"))
      expect(JSON.parse(el.textContent!)).toEqual({ age: 31, state: "Bihar" });
  });

  it("shows nothing rather than crashing when the saved value has been damaged", () => {
    localStorage.setItem("saathi.profile", "{{{ not json");
    render(<Readout />);
    expect(shown()).toEqual({});
  });

  it("drops fields that do not belong, even if something edited the saved value by hand", () => {
    localStorage.setItem(
      "saathi.profile",
      JSON.stringify({ age: 31, aadhaar: "2345 6789 0123", workerType: "astronaut" }),
    );
    render(<Readout />);
    expect(shown()).toEqual({ age: 31 });
  });

  it("copes with a phone that blocks reading saved settings (private mode)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    render(<Readout />);
    expect(shown()).toEqual({});
  });

  it("copes with a phone that blocks saving, without throwing", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(() => saveProfile({ age: 31 })).not.toThrow();
  });

  it("stops listening when the screen goes away", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<Readout />);
    unmount();
    expect(remove).toHaveBeenCalledWith("saathi-profile-change", expect.any(Function));
    expect(remove).toHaveBeenCalledWith("storage", expect.any(Function));
  });

  it("stores only the cleaned profile", () => {
    saveProfile({ age: 31, aadhaar: "2345 6789 0123" } as never);
    expect(JSON.parse(localStorage.getItem("saathi.profile")!)).toEqual({ age: 31 });
  });
});
