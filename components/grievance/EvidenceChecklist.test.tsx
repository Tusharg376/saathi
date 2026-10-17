import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "@/test/axe";
import { renderUi } from "@/test/render";
import { EvidenceChecklist } from "./EvidenceChecklist";

const ITEMS = ["Screenshot of the payout screen", "Order numbers for 14 October", "Chat with support"];

afterEach(() => vi.unstubAllGlobals());

describe("EvidenceChecklist", () => {
  it("lists what to gather, each as a box the worker can tick", () => {
    renderUi(<EvidenceChecklist items={ITEMS} />);
    expect(screen.getByRole("heading", { name: "Collect these before you send" })).toBeInTheDocument();
    for (const item of ITEMS) expect(screen.getByRole("checkbox", { name: item })).not.toBeChecked();
  });

  it("ticks one item without touching the others, and unticks it again", async () => {
    renderUi(<EvidenceChecklist items={ITEMS} />);
    const first = screen.getByRole("checkbox", { name: ITEMS[0] });

    await userEvent.click(first);
    expect(first).toBeChecked();
    expect(screen.getByRole("checkbox", { name: ITEMS[1] })).not.toBeChecked();
    expect(screen.getByText(ITEMS[0])).toHaveClass("line-through"); // visibly crossed off

    await userEvent.click(first);
    expect(first).not.toBeChecked();
    expect(screen.getByText(ITEMS[0])).not.toHaveClass("line-through");
  });

  it("is only for the worker's own tracking: ticking sends nothing anywhere", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderUi(<EvidenceChecklist items={ITEMS} />);
    await userEvent.click(screen.getByRole("checkbox", { name: ITEMS[2] }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(1); // only the language setting; nothing about the complaint is stored
  });

  it("shows nothing at all when there is nothing to gather", () => {
    const { container } = renderUi(<EvidenceChecklist items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is left out of the printed letter", () => {
    const { container } = renderUi(<EvidenceChecklist items={ITEMS} />);
    expect(container.querySelector("section")).toHaveClass("print:hidden");
  });

  it("has no accessibility violations", async () => {
    const { container } = renderUi(<EvidenceChecklist items={ITEMS} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
