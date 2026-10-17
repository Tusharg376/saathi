import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatEvent, ChatRequest } from "@/lib/agent/events";
import { clearHandoff, peekHandoff, setHandoff } from "@/lib/handoff";
import { saveProfile } from "@/lib/profile/store";
import { axe } from "@/test/axe";
import { renderUi } from "@/test/render";
import { Chat } from "./Chat";

const { push, streamChat } = vi.hoisted(() => ({ push: vi.fn(), streamChat: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/chat/client", () => ({ streamChat }));

/** Make the next call to the server stream these events. */
const reply = (...events: ChatEvent[]) =>
  streamChat.mockImplementationOnce(async (_req: ChatRequest, onEvent: (e: ChatEvent) => void) => {
    for (const e of events) onEvent(e);
  });

const entry = {
  date: "2026-10-16",
  platform: "Swiggy",
  grossInr: 1850,
  deductionsInr: 0,
  fuelInr: 400,
  otherCostInr: 0,
};
const text = (t: string): ChatEvent => ({ type: "text", text: t });
const ask = async (question: string) => {
  await userEvent.type(screen.getByRole("textbox"), question);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
};

beforeEach(() => {
  streamChat.mockReset();
  push.mockReset();
  clearHandoff("earnings");
  clearHandoff("complaint");
  clearHandoff("chat");
});
afterEach(() => vi.unstubAllGlobals());

describe("Chat: asking and answering", () => {
  it("starts with quick questions the worker can tap", async () => {
    reply(text("Go to eshram.gov.in."), { type: "done" });
    renderUi(<Chat />);
    await userEvent.click(screen.getByRole("button", { name: "How do I get an e-Shram card?" }));
    expect(await screen.findByText("Go to eshram.gov.in.")).toBeInTheDocument();
    expect(screen.getByText("How do I get an e-Shram card?")).toBeInTheDocument();
  });

  it("sends the question with the language, today's date and the saved profile", async () => {
    saveProfile({ age: 31, state: "Bihar" });
    reply(text("ok"), { type: "done" });
    renderUi(<Chat />);
    await ask("Which pension can I get?");
    await screen.findByText("ok");

    const [req] = streamChat.mock.calls[0] as [ChatRequest];
    expect(req.lang).toBe("en");
    expect(req.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(req.profile).toMatchObject({ age: 31, state: "Bihar" });
    expect(req.messages.at(-1)).toEqual({ role: "user", text: "Which pension can I get?" });
  });

  it("shows where the answer came from", async () => {
    reply(text("PM-SYM is a pension."), { type: "sources", ids: ["scheme.pmsym"] }, { type: "done" });
    renderUi(<Chat />);
    await ask("pension?");
    expect(await screen.findByText("Where this comes from")).toBeInTheDocument();
  });

  it("says plainly when a long answer has no saved source behind it, and not when it has one or is just a greeting", async () => {
    const long = "You can ask the platform to explain the cut. ".repeat(6);
    reply(text(long), { type: "done" });
    renderUi(<Chat />);
    await ask("what should I do?");
    expect(await screen.findByText(/No saved source for this answer/)).toBeInTheDocument();
  });

  it("does not add that note to a short reply, or to an answer that has a source", async () => {
    reply(text("Hello! How can I help?"), { type: "done" });
    const first = renderUi(<Chat />);
    await ask("hi");
    await screen.findByText("Hello! How can I help?");
    expect(screen.queryByText(/No saved source/)).not.toBeInTheDocument();
    first.unmount();

    const long = "PM-SYM is a pension for workers in the informal sector. ".repeat(5);
    reply(text(long), { type: "sources", ids: ["scheme.pmsym"] }, { type: "done" });
    renderUi(<Chat />);
    await ask("pension?");
    await screen.findByText("Where this comes from");
    expect(screen.queryByText(/No saved source/)).not.toBeInTheDocument();
  });

  it("sends with Enter, but a new line with Shift+Enter does not send", async () => {
    reply(text("sent"), { type: "done" });
    renderUi(<Chat />);
    const box = screen.getByRole("textbox");
    await userEvent.type(box, "line one{Shift>}{Enter}{/Shift}line two");
    expect(streamChat).not.toHaveBeenCalled();
    await userEvent.type(box, "{Enter}");
    await screen.findByText("sent");
    expect(streamChat).toHaveBeenCalledTimes(1);
  });

  it("cannot send an empty message", () => {
    renderUi(<Chat />);
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("starts a fresh conversation with New chat", async () => {
    reply(text("an answer"), { type: "done" });
    renderUi(<Chat />);
    await ask("hello");
    await screen.findByText("an answer");
    await userEvent.click(screen.getByRole("button", { name: "New chat" }));
    expect(screen.queryByText("an answer")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "How do I get an e-Shram card?" })).toBeInTheDocument();
  });

  it("opens with a question handed over from another screen", () => {
    setHandoff("chat", { prompt: "Tell me about: PM-SYM pension" });
    renderUi(<Chat />);
    expect(screen.getByRole("textbox")).toHaveValue("Tell me about: PM-SYM pension");
  });
});

describe("Chat: emergencies", () => {
  it("shows the call buttons straight away, before the server has answered", async () => {
    streamChat.mockImplementationOnce(() => new Promise(() => undefined)); // the server never replies
    renderUi(<Chat />);
    await ask("mera accident ho gaya hai, khoon beh raha hai");
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("link", { name: /112/ })).toHaveAttribute("href", "tel:112");
  });
});

describe("Chat: when the AI cannot answer", () => {
  it("offline: says so and still offers cards from the on-device knowledge base", async () => {
    streamChat.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    renderUi(<Chat />);
    await ask("Tell me about accident insurance");
    expect(await screen.findByText(/No internet/)).toBeInTheDocument();
    expect(await screen.findByText("Found without AI")).toBeInTheDocument();
  });

  it("no API key: explains that smart answers are off instead of failing silently", async () => {
    reply({ type: "error", code: "no_key", message: "x" }, { type: "done" });
    renderUi(<Chat />);
    await ask("hello");
    expect(await screen.findByText("Smart answers are not switched on yet")).toBeInTheDocument();
  });

  it("rate limited: tells the worker to wait, with no retry button to hammer", async () => {
    reply({ type: "error", code: "rate_limited", message: "x" }, { type: "done" });
    renderUi(<Chat />);
    await ask("hello");
    expect(await screen.findByText(/Too many questions/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("Try again asks the same question again, without repeating it on screen", async () => {
    streamChat.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    reply(text("Here you go."), { type: "done" });
    renderUi(<Chat />);
    await ask("my question");
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Here you go.")).toBeInTheDocument();
    expect(streamChat).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText("my question")).toHaveLength(1);
  });
});

describe("Chat: next steps the assistant proposes", () => {
  it("an earning card opens the Earnings screen with the entry waiting there to be checked", async () => {
    reply(text("I found it."), { type: "action", action: { kind: "log_earning", entry } }, { type: "done" });
    renderUi(<Chat />);
    await ask("aaj Swiggy pe 1850 kamaye");
    await userEvent.click(await screen.findByRole("button", { name: "Check and save" }));
    expect(push).toHaveBeenCalledWith("/earnings");
    expect(peekHandoff("earnings")).toEqual({ entries: [entry] });
  });

  it("a complaint card opens the complaint with the issue and summary filled in", async () => {
    const action = {
      kind: "start_complaint",
      issue: "penalty",
      summary: "Fined Rs 300 with no reason.",
      party: "Zomato",
    } as const;
    reply(text("That seems unfair."), { type: "action", action }, { type: "done" });
    renderUi(<Chat />);
    await ask("they fined me for nothing");
    await userEvent.click(await screen.findByRole("button", { name: "Write the complaint" }));
    expect(push).toHaveBeenCalledWith("/help/complaint");
    expect(peekHandoff("complaint")).toEqual({ issue: "penalty", description: action.summary, party: "Zomato" });
  });

  it("nothing is saved or sent just by being shown the card", async () => {
    reply({ type: "action", action: { kind: "log_earning", entry } }, { type: "done" });
    renderUi(<Chat />);
    await ask("aaj Swiggy pe 1850 kamaye");
    await screen.findByRole("button", { name: "Check and save" });
    expect(push).not.toHaveBeenCalled();
    expect(peekHandoff("earnings")).toBeUndefined();
  });
});

describe("Chat: accessibility", () => {
  it("the welcome screen has no violations", async () => {
    const { container } = renderUi(<Chat />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("a conversation with an answer and a proposal has no violations", async () => {
    reply(text("An answer."), { type: "action", action: { kind: "log_earning", entry } }, { type: "done" });
    const { container } = renderUi(<Chat />);
    await ask("hi");
    await screen.findByRole("button", { name: "Check and save" });
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    await act(async () => undefined);
    expect(await axe(container)).toHaveNoViolations();
  });
});
