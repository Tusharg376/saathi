import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "@/test/axe";
import { renderUi } from "@/test/render";
import { getEntry } from "@/lib/kb";
import { EscalationLadder } from "./EscalationLadder";

const penalty = getEntry("grievance.penalty")!;
const deactivation = getEntry("grievance.deactivation")!;

describe("EscalationLadder: if no one replies", () => {
  it("lists the offices to try, in order, as numbered steps", () => {
    renderUi(<EscalationLadder entry={penalty} />);
    const steps = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(steps.map((s) => s.textContent)).toEqual(penalty.steps);
    expect(screen.getByRole("list").tagName).toBe("OL");
  });

  it("offers a number to call, which is a real link the phone can dial", () => {
    renderUi(<EscalationLadder entry={penalty} />);
    expect(screen.getByRole("link", { name: /14434/ })).toHaveAttribute("href", `tel:${penalty.helpline}`);
  });

  it("repeats the caution where waiting times are only suggestions, so none is read as a legal deadline", () => {
    renderUi(<EscalationLadder entry={deactivation} />);
    expect(screen.getByText(/suggestions, not legal deadlines/)).toBeInTheDocument();
  });

  it("shows nothing for a card that has no steps, rather than an empty box", () => {
    const { container } = renderUi(<EscalationLadder entry={{ ...penalty, steps: undefined }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("leaves out the call link when the card has no helpline", () => {
    renderUi(<EscalationLadder entry={{ ...penalty, helpline: undefined }} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderUi(<EscalationLadder entry={deactivation} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
