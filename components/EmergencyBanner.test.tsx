import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "@/test/axe";
import { renderUi } from "@/test/render";
import { EmergencyBanner } from "./EmergencyBanner";

describe("EmergencyBanner: an emergency in the worker's words", () => {
  it("urgent: shows big one-tap call buttons that interrupt, named in plain words with the number on a plate", () => {
    renderUi(<EmergencyBanner severity="urgent" helplines={["ambulance_108", "emergency_112"]} />);

    const banner = screen.getByRole("alert", { name: "If someone is hurt or in danger, call now" });
    const ambulance = within(banner).getByRole("link", { name: /Ambulance/ });
    expect(ambulance).toHaveAttribute("href", "tel:108");
    expect(within(ambulance).getByText("108")).toBeInTheDocument();
    expect(within(banner).getByRole("link", { name: /Emergency/ })).toHaveAttribute("href", "tel:112");
  });

  it("urgent: never lists more than three numbers, so the right one is easy to find in a panic", () => {
    renderUi(
      <EmergencyBanner
        severity="urgent"
        helplines={["emergency_112", "ambulance_108", "police_100", "women_181", "cyber_1930"]}
      />,
    );
    expect(within(screen.getByRole("alert")).getAllByRole("link")).toHaveLength(3);
  });

  it("urgent: skips a helpline it does not know instead of showing a blank button", () => {
    renderUi(<EmergencyBanner severity="urgent" helplines={["not_a_real_helpline", "emergency_112"]} />);
    const links = within(screen.getByRole("alert")).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "tel:112");
  });

  it("urgent: uses the worker's language for the names of the numbers", () => {
    renderUi(<EmergencyBanner severity="urgent" helplines={["ambulance_108"]} />, "hi");
    expect(screen.getByRole("alert")).toHaveTextContent("एम्बुलेंस");
  });

  it("works with no internet and no AI: it only draws links and never sends anything", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderUi(<EmergencyBanner severity="urgent" helplines={["emergency_112"]} />);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("possible: stays one quiet line pointing to 112, so a passing mention of an accident does not scare anyone", () => {
    renderUi(<EmergencyBanner severity="possible" helplines={["emergency_112"]} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument(); // not announced as an emergency
    const line = screen.getByRole("status");
    expect(within(line).getByRole("link", { name: "If this is an emergency, call 112" })).toHaveAttribute(
      "href",
      "tel:112",
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("has no accessibility violations in either mode", async () => {
    const urgent = renderUi(<EmergencyBanner severity="urgent" helplines={["emergency_112", "women_181"]} />);
    expect(await axe(urgent.container)).toHaveNoViolations();
    urgent.unmount();
    const possible = renderUi(<EmergencyBanner severity="possible" helplines={["emergency_112"]} />);
    expect(await axe(possible.container)).toHaveNoViolations();
  });
});
