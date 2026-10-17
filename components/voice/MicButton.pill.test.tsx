import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "@/test/axe";
import { renderUi } from "@/test/render";
import { MicButton } from "./MicButton";

class FakeRecognition {
  static last: FakeRecognition;
  static startFails = false;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  onresult: ((e: unknown) => void) | null = null;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {
    if (FakeRecognition.startFails) throw new Error("already started");
  }
  stop() {
    this.onend?.();
  }
}

function Box() {
  const [value, setValue] = useState("");
  return <MicButton value={value} onChange={setValue} variant="pill" />;
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeRecognition.startFails = false;
});

describe("MicButton: the wide button with a word on it", () => {
  it("says what it does in words, so it is clear next to a text box", () => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    renderUi(<Box />);
    expect(screen.getByRole("button", { name: "Speak" })).toHaveTextContent("Speak");
  });

  it("changes to Stop while listening, and back when the worker stops it", async () => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    renderUi(<Box />);
    await userEvent.click(screen.getByRole("button", { name: "Speak" }));
    expect(screen.getByRole("button", { name: "Stop" })).toHaveTextContent("Stop");
    await userEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(screen.getByRole("button", { name: "Speak" })).toBeInTheDocument();
  });

  it("goes back to Speak with a gentle message when the microphone cannot be started", async () => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    FakeRecognition.startFails = true;
    renderUi(<Box />);

    await userEvent.click(screen.getByRole("button", { name: "Speak" }));

    expect(screen.getByRole("button", { name: "Speak" })).toBeInTheDocument(); // not stuck on "Stop"
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not hear. Try again or type.");
  });

  it("clears the old message the next time the worker tries", async () => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    renderUi(<Box />);
    await userEvent.click(screen.getByRole("button", { name: "Speak" }));
    act(() => FakeRecognition.last.onerror?.({ error: "not-allowed" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Speak" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("has no accessibility violations, idle or listening", async () => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    const { container } = renderUi(<Box />);
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole("button", { name: "Speak" }));
    expect(await axe(container)).toHaveNoViolations();
  });
});
