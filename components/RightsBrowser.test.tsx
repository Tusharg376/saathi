import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearHandoff, peekHandoff } from "@/lib/handoff";
import { allEntries, getEntry } from "@/lib/kb";
import { sanitizeProfile } from "@/lib/profile/store";
import { axe } from "@/test/axe";
import { renderUi } from "@/test/render";
import { RightsBrowser } from "./RightsBrowser";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  push.mockReset();
  clearHandoff("chat");
});

const titleOf = (id: string) => getEntry(id)!.title;
const cards = () => screen.getAllByRole("article");

describe("RightsBrowser: finding things with no AI and no network", () => {
  it("lists the library a page at a time, and shows more on request", async () => {
    renderUi(<RightsBrowser />);
    expect(cards()).toHaveLength(10);
    await userEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(cards().length).toBeGreaterThan(10);
  });

  it("finds a scheme by what the worker types", async () => {
    renderUi(<RightsBrowser />);
    await userEvent.type(screen.getByRole("searchbox"), "pension");
    expect(await screen.findByRole("heading", { name: titleOf("scheme.pmsym") })).toBeInTheDocument();
  });

  it("says so, instead of showing unrelated cards, when nothing matches", async () => {
    renderUi(<RightsBrowser />);
    await userEvent.type(screen.getByRole("searchbox"), "zzzxqv");
    expect(await screen.findByText("Nothing found. Try another word.")).toBeInTheDocument();
    expect(screen.queryAllByRole("article")).toHaveLength(0);
  });

  it("filters by kind", async () => {
    renderUi(<RightsBrowser />);
    await userEvent.click(screen.getByRole("button", { name: "Schemes" }));
    const schemes = allEntries().filter((e) => e.category === "scheme");
    expect(screen.getByRole("button", { name: "Schemes" })).toHaveAttribute("aria-pressed", "true");
    expect(cards().length).toBe(Math.min(10, schemes.length));
    for (const card of cards()) expect(within(card).queryByText(/grievance/i)).not.toBeInTheDocument();
  });

  it("starts the list from the top when the search changes", async () => {
    renderUi(<RightsBrowser />);
    await userEvent.click(screen.getByRole("button", { name: "Show more" }));
    await userEvent.click(screen.getByRole("button", { name: "Safety" }));
    expect(cards().length).toBeLessThanOrEqual(10);
  });
});

describe("RightsBrowser: what do I qualify for", () => {
  const openForm = () => userEvent.click(screen.getByText("Check what I qualify for"));
  const answer = (legend: string, option: "Yes" | "No" | "Not sure") =>
    userEvent.click(within(screen.getByRole("group", { name: legend })).getByLabelText(option));
  // The row's own title comes first; the expandable card inside it repeats the title after.
  const resultFor = (id: string) =>
    within(screen.getByRole("region", { name: "What you may get" }))
      .getAllByText(titleOf(id))[0]
      .closest("li")!;

  it("says Likely when the rules clearly match", async () => {
    renderUi(<RightsBrowser />);
    await openForm();
    await userEvent.type(screen.getByLabelText("Your age"), "25");
    await userEvent.type(screen.getByLabelText("Monthly income (Rs)"), "12000");
    await answer("Do you pay income tax?", "No");
    await answer("Are you in EPFO (PF) or ESIC?", "No");
    await userEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(within(resultFor("scheme.pmsym")).getByText("Likely")).toBeInTheDocument();
  });

  it("says Not eligible when a rule clearly fails", async () => {
    renderUi(<RightsBrowser />);
    await openForm();
    await userEvent.type(screen.getByLabelText("Your age"), "55");
    await userEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(within(resultFor("scheme.pmsym")).getByText("Not eligible")).toBeInTheDocument();
  });

  it("treats Not sure as unknown, so it says Maybe and what to tell us, never a false No", async () => {
    renderUi(<RightsBrowser />);
    await openForm();
    await userEvent.type(screen.getByLabelText("Your age"), "30");
    await userEvent.click(screen.getByRole("button", { name: "Check" }));

    const row = resultFor("scheme.pmsym");
    expect(within(row).getByText("Maybe")).toBeInTheDocument();
    expect(within(row).getByText(/To be sure, tell us/)).toBeInTheDocument();
  });

  it("never says Likely for a benefit that is only announced", async () => {
    renderUi(<RightsBrowser />);
    await openForm();
    await answer("Do you work through an app?", "Yes");
    await answer("Are you registered on e-Shram?", "Yes");
    await userEvent.click(screen.getByRole("button", { name: "Check" }));
    const row = resultFor("scheme.pmjay_gig");
    expect(within(row).getByText("Maybe")).toBeInTheDocument();
    expect(within(row).queryByText("Likely")).not.toBeInTheDocument();
  });

  it("remembers the answers on this phone only", async () => {
    renderUi(<RightsBrowser />);
    await openForm();
    await userEvent.type(screen.getByLabelText("Your age"), "29");
    await userEvent.type(screen.getByLabelText("Your state"), "Bihar");
    await userEvent.click(screen.getByRole("button", { name: "Check" }));

    const stored = Object.entries(localStorage)
      .map(([, v]) => v)
      .join("");
    expect(sanitizeProfile(JSON.parse(localStorage.getItem("saathi.profile") ?? "{}"))).toMatchObject({
      age: 29,
      state: "Bihar",
    });
    expect(stored).toContain("Bihar");
  });

  it("hands the result to the chat to explain in the worker's language", async () => {
    renderUi(<RightsBrowser />);
    await openForm();
    await userEvent.type(screen.getByLabelText("Your age"), "30");
    await userEvent.click(screen.getByRole("button", { name: "Check" }));
    await userEvent.click(screen.getByRole("button", { name: "Explain with Saathi" }));

    expect(push).toHaveBeenCalledWith("/");
    expect(peekHandoff("chat")?.prompt).toMatch(/which schemes can I get/i);
  });
});

describe("RightsBrowser: accessibility", () => {
  it("has no violations", async () => {
    const { container } = renderUi(<RightsBrowser />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no violations with the qualify form open and results showing", async () => {
    const { container } = renderUi(<RightsBrowser />);
    await userEvent.click(screen.getByText("Check what I qualify for"));
    await userEvent.type(screen.getByLabelText("Your age"), "30");
    await userEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(await axe(container)).toHaveNoViolations();
  });
});
