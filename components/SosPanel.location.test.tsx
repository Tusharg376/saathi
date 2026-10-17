import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderUi } from "@/test/render";
import { SosPanel } from "./SosPanel";

type Success = (pos: { coords: { latitude: number; longitude: number } }) => void;
type Failure = () => void;

/** A phone whose location answers when the test says so (or refuses). */
function phone() {
  const calls: { ok: Success; fail: Failure; options: PositionOptions }[] = [];
  const assign = vi.fn();
  vi.stubGlobal("navigator", {
    ...navigator,
    geolocation: {
      getCurrentPosition: (ok: Success, fail: Failure, options: PositionOptions) => calls.push({ ok, fail, options }),
    },
  });
  vi.stubGlobal("location", { assign });
  return { calls, assign };
}

afterEach(() => vi.unstubAllGlobals());

const shareButton = () => screen.getByRole("button", { name: /Send my location|Finding your location/ });

describe("SosPanel: sending my location", () => {
  it("hands the worker's position to WhatsApp as a map link, and lets them choose who gets it", async () => {
    const { calls, assign } = phone();
    renderUi(<SosPanel />);
    await userEvent.click(shareButton());

    calls[0].ok({ coords: { latitude: 12.9716, longitude: 77.5946 } });

    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    const url = new URL(assign.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe("https://wa.me/"); // no phone number: the worker picks the chat
    expect(url.searchParams.get("text")).toBe("I need help. My location: https://maps.google.com/?q=12.9716,77.5946");
  });

  it("shows that it is finding the location, and blocks a second tap meanwhile", async () => {
    const { calls } = phone();
    renderUi(<SosPanel />);
    await userEvent.click(shareButton());

    expect(screen.getByRole("button", { name: "Finding your location…" })).toBeDisabled();
    expect(screen.getByRole("status", { name: "Finding your location…" })).toBeInTheDocument();
    expect(calls).toHaveLength(1);

    calls[0].ok({ coords: { latitude: 1, longitude: 2 } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Send my location on WhatsApp" })).toBeEnabled());
  });

  it("asks for a precise position but gives up after a short wait instead of hanging in an emergency", async () => {
    const { calls } = phone();
    renderUi(<SosPanel />);
    await userEvent.click(shareButton());
    expect(calls[0].options).toMatchObject({ enableHighAccuracy: true, timeout: 12000 });
  });

  it("sends nothing anywhere when location is refused, and a retry can still work", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { calls, assign } = phone();
    renderUi(<SosPanel />);

    await userEvent.click(shareButton());
    calls[0].fail();
    expect(await screen.findByRole("alert")).toHaveTextContent(/Allow location access/);
    expect(assign).not.toHaveBeenCalled();

    await userEvent.click(shareButton());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(); // the old complaint is cleared while retrying
    calls[1].ok({ coords: { latitude: 28.6, longitude: 77.2 } });
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    expect(fetchMock).not.toHaveBeenCalled(); // the location only ever goes to the chat the worker picks
  });
});
