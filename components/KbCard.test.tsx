import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearHandoff, peekHandoff } from "@/lib/handoff";
import { getEntry, type KbEntry } from "@/lib/kb";
import { axe } from "@/test/axe";
import { renderUi } from "@/test/render";
import { KbCard } from "./KbCard";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const entryOf = (id: string): KbEntry => {
  const e = getEntry(id);
  if (!e) throw new Error(`no knowledge-base entry ${id}`);
  return e;
};

beforeEach(() => {
  push.mockReset();
  clearHandoff("chat");
  clearHandoff("complaint");
});

describe("KbCard", () => {
  it("shows the title, summary and where the information comes from", () => {
    const e = entryOf("scheme.pmsym");
    renderUi(<KbCard entry={e} />);
    expect(screen.getByRole("heading", { name: e.title })).toBeInTheDocument();
    expect(screen.getByText(e.summary)).toBeInTheDocument();

    const source = screen.getByRole("link", { name: /Official source/ });
    expect(source).toHaveAttribute("href", e.source_url);
    expect(source).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("labels a source that is not a government site as exactly that, not as official", () => {
    const e = entryOf("right.gig_act_karnataka");
    expect(new URL(e.source_url).host).not.toMatch(/gov\.in$|nic\.in$/);
    renderUi(<KbCard entry={e} />);
    expect(screen.getByRole("link", { name: /Source \(not a government site\)/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Official source/ })).not.toBeInTheDocument();
  });

  it("is honest that an entry has not been checked by a person yet", () => {
    const e = entryOf("scheme.pmsym");
    expect(e.last_verified).toBeNull();
    renderUi(<KbCard entry={e} />);
    expect(screen.getByText("Not yet checked by our team")).toBeInTheDocument();
  });

  it("never presents an announced benefit as running", () => {
    const e = entryOf("scheme.pmjay_gig");
    renderUi(<KbCard entry={e} />);
    expect(screen.getByText("Announced, not confirmed")).toBeInTheDocument();
    expect(screen.queryByText("Running")).not.toBeInTheDocument();
    expect(screen.getByText(/Good to know/)).toBeInTheDocument(); // the status note is shown
  });

  it("offers a one-tap call to the helpline", () => {
    const e = entryOf("scheme.eshram");
    renderUi(<KbCard entry={e} />);
    expect(screen.getByRole("link", { name: /Helpline/ })).toHaveAttribute("href", `tel:${e.helpline}`);
  });

  it("uses the heading level it is told to, so headings stay in order on the page", () => {
    renderUi(<KbCard entry={entryOf("scheme.pmsym")} headingLevel="h2" />);
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
  });

  it("marks untranslated text as English, so a screen reader does not read it in the wrong voice", () => {
    const e = entryOf("scheme.pmsym");
    renderUi(<KbCard entry={e} />, "hi");
    // No Hindi translation of this entry exists yet, so its text is English inside a Hindi screen.
    expect(screen.getByText(e.summary)).toHaveAttribute("lang", "en");
  });
});

describe("KbCard: next steps", () => {
  it("Ask Saathi opens the chat with a question about this card", async () => {
    const e = entryOf("scheme.pmsym");
    renderUi(<KbCard entry={e} />);
    await userEvent.click(screen.getByRole("button", { name: "Ask Saathi about this" }));
    expect(push).toHaveBeenCalledWith("/");
    expect(peekHandoff("chat")).toEqual({ prompt: `Tell me about: ${e.title}` });
  });

  it("a complaint-route card can start that complaint", async () => {
    renderUi(<KbCard entry={entryOf("grievance.deactivation")} />);
    await userEvent.click(screen.getByRole("button", { name: "Write this complaint" }));
    expect(push).toHaveBeenCalledWith("/help/complaint");
    expect(peekHandoff("complaint")).toEqual({ issue: "deactivation" });
  });

  it("a scheme card does not offer a complaint", () => {
    renderUi(<KbCard entry={entryOf("scheme.pmsym")} />);
    expect(screen.queryByRole("button", { name: "Write this complaint" })).not.toBeInTheDocument();
  });

  it("shows no buttons where the card already sits inside the chat", () => {
    renderUi(<KbCard entry={entryOf("grievance.deactivation")} showActions={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows whatever extra action it is given", () => {
    renderUi(<KbCard entry={entryOf("scheme.pmsym")} action={<button type="button">Extra</button>} />);
    expect(within(screen.getByRole("article")).getByRole("button", { name: "Extra" })).toBeInTheDocument();
  });
});

describe("KbCard: accessibility", () => {
  it("has no violations", async () => {
    const { container } = renderUi(<KbCard entry={entryOf("grievance.deactivation")} headingLevel="h2" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
