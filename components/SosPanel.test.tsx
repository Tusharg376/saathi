import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "@/test/axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderUi } from "@/test/render";
import { SosPanel } from "./SosPanel";

afterEach(() => vi.unstubAllGlobals());

describe("SosPanel", () => {
  it("offers a one-tap call to each emergency number", () => {
    renderUi(<SosPanel />);
    for (const number of ["112", "108", "181", "1930"]) {
      const link = screen.getByRole("link", { name: new RegExp(number) });
      expect(link).toHaveAttribute("href", `tel:${number}`);
    }
  });

  it("works with no network and no AI: it never makes a request", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    renderUi(<SosPanel />);
    expect(screen.getByText(/works without internet/i)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("explains what went wrong when the phone has no location support", async () => {
    vi.stubGlobal("navigator", { ...navigator, geolocation: undefined });
    delete (navigator as { geolocation?: unknown }).geolocation;
    renderUi(<SosPanel />);
    await userEvent.click(screen.getByRole("button", { name: /send my location/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not get your location/i);
  });

  it("explains it too when the worker refuses permission", async () => {
    const getCurrentPosition = vi.fn((_ok: unknown, fail: () => void) => fail());
    vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition } });
    renderUi(<SosPanel />);
    await userEvent.click(screen.getByRole("button", { name: /send my location/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/allow location access/i);
  });

  it("has no accessibility violations", async () => {
    const { container } = renderUi(<SosPanel />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
