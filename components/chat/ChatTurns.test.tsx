import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatEvent, ChatRequest } from "@/lib/agent/events";
import { clearHandoff } from "@/lib/handoff";
import { renderUi } from "@/test/render";
import { Chat } from "./Chat";

const { streamChat } = vi.hoisted(() => ({ streamChat: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/chat/client", () => ({ streamChat }));

type OnEvent = (e: ChatEvent) => void;
const text = (t: string): ChatEvent => ({ type: "text", text: t });

/** A reply that streams some events, then waits until the worker presses Stop (or leaves) before it ends. */
const replyUntilStopped = (...events: ChatEvent[]) =>
  streamChat.mockImplementationOnce(
    (_req: ChatRequest, onEvent: OnEvent, signal: AbortSignal) =>
      new Promise((_resolve, reject) => {
        for (const e of events) onEvent(e);
        signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      }),
  );
const reply = (...events: ChatEvent[]) =>
  streamChat.mockImplementationOnce(async (_req: ChatRequest, onEvent: OnEvent) => {
    for (const e of events) onEvent(e);
  });

const box = () => screen.getByRole("textbox");
const ask = async (question: string) => {
  await userEvent.type(box(), question);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
};

/** A phone that can read English aloud; every spoken piece "finishes" on the next tick. */
function phoneThatSpeaks() {
  const spoken: string[] = [];
  const synth = {
    getVoices: () => [{ lang: "en-IN", name: "English India", localService: true }],
    addEventListener: vi.fn(),
    cancel: vi.fn(),
    speak: vi.fn((u: { text: string; onend: (() => void) | null }) => {
      spoken.push(u.text);
      setTimeout(() => u.onend?.(), 0);
    }),
  };
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      voice: unknown;
      lang = "";
      rate = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    },
  );
  return { spoken, synth };
}

beforeEach(() => {
  streamChat.mockReset();
  clearHandoff("chat");
});
afterEach(() => vi.unstubAllGlobals());

describe("Chat: stopping and leaving", () => {
  it("Stop ends the answer where it is, keeps what had arrived, and does not call that a failure", async () => {
    replyUntilStopped(text("The first part of the answer"));
    renderUi(<Chat />);
    await ask("Tell me about pensions");

    await userEvent.click(await screen.findByRole("button", { name: "Stop" }));

    expect(await screen.findByRole("button", { name: "Send" })).toBeInTheDocument();
    expect(await screen.findByText("The first part of the answer")).toBeInTheDocument(); // the list loads on demand
    expect(screen.queryByText(/No internet/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("New chat during an answer cancels the request instead of letting it run on", async () => {
    let signal: AbortSignal | undefined;
    streamChat.mockImplementationOnce((_r: ChatRequest, onEvent: OnEvent, s: AbortSignal) => {
      signal = s;
      onEvent(text("Working on it"));
      return new Promise(() => undefined);
    });
    renderUi(<Chat />);
    await ask("hello");
    await userEvent.click(await screen.findByRole("button", { name: "New chat" }));

    expect(signal?.aborted).toBe(true);
    expect(screen.queryByText("Working on it")).not.toBeInTheDocument();
  });

  it("leaving the screen cancels the request and stops any reading aloud", async () => {
    const { synth } = phoneThatSpeaks();
    let signal: AbortSignal | undefined;
    streamChat.mockImplementationOnce((_r: ChatRequest, _e: OnEvent, s: AbortSignal) => {
      signal = s;
      return new Promise(() => undefined);
    });
    const { unmount } = renderUi(<Chat />);
    await ask("hello");
    await screen.findByRole("button", { name: "Stop" });
    synth.cancel.mockClear();

    unmount();

    expect(signal?.aborted).toBe(true);
    expect(synth.cancel).toHaveBeenCalled();
  });
});

describe("Chat: one question at a time", () => {
  it("keeps what the worker typed, and sends nothing, if they press Enter while an answer is still coming", async () => {
    replyUntilStopped(text("Still answering"));
    renderUi(<Chat />);
    await ask("first question");
    await screen.findByText("Still answering");

    await userEvent.type(box(), "second question{Enter}");

    expect(streamChat).toHaveBeenCalledTimes(1);
    expect(box()).toHaveValue("second question"); // not thrown away: it can be sent once the answer ends
  });
});

describe("Chat: reading answers aloud", () => {
  it("reads a finished answer aloud when the worker has asked for that", async () => {
    localStorage.setItem("saathi.pref.autoRead", "1");
    const { spoken } = phoneThatSpeaks();
    reply(text("Apply on the e-Shram website."), { type: "done" });
    renderUi(<Chat />);
    await ask("e-Shram?");
    await waitFor(() => expect(spoken.join(" ")).toContain("Apply on the e-Shram website."));
  });

  it("stays quiet unless the worker asked for it, because a phone should not speak by surprise", async () => {
    const { spoken } = phoneThatSpeaks();
    reply(text("Apply on the e-Shram website."), { type: "done" });
    renderUi(<Chat />);
    await ask("e-Shram?");
    await screen.findByText("Apply on the e-Shram website.");
    await new Promise((r) => setTimeout(r, 30));
    expect(spoken).toEqual([]);
  });

  it("does not read out an answer the worker stopped", async () => {
    localStorage.setItem("saathi.pref.autoRead", "1");
    const { spoken } = phoneThatSpeaks();
    replyUntilStopped(text("A half answer"));
    renderUi(<Chat />);
    await ask("hello");
    await screen.findByText("A half answer");
    await userEvent.click(screen.getByRole("button", { name: "Stop" }));
    await screen.findByRole("button", { name: "Send" });
    await new Promise((r) => setTimeout(r, 30));
    expect(spoken).toEqual([]);
  });

  it("silences the last answer as soon as a new question is asked", async () => {
    const { synth } = phoneThatSpeaks();
    reply(text("First answer."), { type: "done" });
    reply(text("Second answer."), { type: "done" });
    renderUi(<Chat />);
    await ask("one");
    await screen.findByText("First answer.");
    synth.cancel.mockClear();

    await ask("two");

    expect(synth.cancel).toHaveBeenCalled();
    await screen.findByText("Second answer.");
  });
});

describe("Chat: what the screen says while it works and when it fails", () => {
  it("names what the assistant is doing while it looks something up", async () => {
    replyUntilStopped({ type: "tool", name: "check_scheme_eligibility" });
    renderUi(<Chat />);
    await ask("Do I qualify for a pension?");
    expect(await screen.findByRole("status", { name: "Checking if you qualify…" })).toBeInTheDocument();
  });

  it("says 'Thinking' for a lookup it has no special wording for", async () => {
    replyUntilStopped({ type: "tool", name: "some_new_tool" });
    renderUi(<Chat />);
    await ask("hello");
    expect(await screen.findByRole("status", { name: "Thinking…" })).toBeInTheDocument();
  });

  it("shows a general failure message with Try again when the server reports an error it has no special words for", async () => {
    reply({ type: "error", code: "bad_request", message: "x" }, { type: "done" });
    renderUi(<Chat />);
    await ask("hello");
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. Please try again.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("tells the worker a private number was hidden from their message", async () => {
    reply({ type: "notice", code: "pii_redacted", found: ["aadhaar"] }, text("Noted."), { type: "done" });
    renderUi(<Chat />);
    await ask("my aadhaar is 2345 6789 0123, is my pension ok?");
    expect(await screen.findByText(/private number .* was hidden/)).toBeInTheDocument();
  });
});
