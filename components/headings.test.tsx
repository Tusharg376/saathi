import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatEvent, ChatRequest } from "@/lib/agent/events";
import { _openForTest } from "@/lib/db";
import { getEntry } from "@/lib/kb";
import { renderUi } from "@/test/render";
import { Chat } from "./chat/Chat";
import { EarningsView } from "./earnings/EarningsView";
import { KbCard } from "./KbCard";

const { streamChat } = vi.hoisted(() => ({ streamChat: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/chat/client", () => ({ streamChat }));

/** Screen readers jump between headings, so each page needs one h1 and no skipped levels. */
describe("headings stay in order", () => {
  const levels = () => screen.getAllByRole("heading", { hidden: true }).map((h) => Number(h.tagName.slice(1)));

  it("a card's section titles sit one level below the card's own title, on a page where the card is an h2", () => {
    renderUi(<KbCard entry={getEntry("scheme.pmsym")!} headingLevel="h2" />);
    const [title, ...sections] = levels();
    expect(title).toBe(2);
    expect(sections.length).toBeGreaterThan(0);
    expect(new Set(sections)).toEqual(new Set([3]));
  });

  it("and one level below an h3 card elsewhere, such as inside a chat answer", () => {
    renderUi(<KbCard entry={getEntry("scheme.pmsym")!} />);
    const [title, ...sections] = levels();
    expect(title).toBe(3);
    expect(new Set(sections)).toEqual(new Set([4]));
  });

  it("the chat keeps its page heading after the welcome greeting is replaced by the conversation", async () => {
    streamChat.mockImplementationOnce(async (_req: ChatRequest, onEvent: (e: ChatEvent) => void) => {
      onEvent({ type: "text", text: "Go to eshram.gov.in." });
      onEvent({ type: "done" });
    });
    renderUi(<Chat />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1); // the greeting

    await userEvent.click(screen.getByRole("button", { name: "How do I get an e-Shram card?" }));
    await screen.findByText("Go to eshram.gov.in.");

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});

describe("the earnings title does not wait for the phone's storage", () => {
  beforeEach(() => _openForTest("headings-earnings"));

  it("shows the heading on the very first render, with the loading indicator under it", () => {
    renderUi(<EarningsView />);
    expect(screen.getByRole("heading", { level: 1, name: "Earnings" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Earnings" })).toBeInTheDocument();
  });
});
