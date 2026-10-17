import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderUi } from "@/test/render";
import { MicButton } from "./MicButton";

/** A stand-in for the browser's speech recognition that the test can drive. */
class FakeRecognition {
  static last: FakeRecognition | null = null;
  lang = "";
  continuous = true;
  interimResults = false;
  maxAlternatives = 0;
  started = false;
  stopped = false;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
    this.onend?.();
  }
  abort() {}
  hear(transcript: string, isFinal = true) {
    this.onresult?.({ resultIndex: 0, results: { length: 1, 0: { isFinal, 0: { transcript } } } });
  }
}

/** A text box wired to the mic, the way the real screens use it. */
function Box({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <p data-testid="value">{value}</p>
      <MicButton value={value} onChange={setValue} />
    </>
  );
}

beforeEach(() => {
  FakeRecognition.last = null;
});
afterEach(() => vi.unstubAllGlobals());

const enableSpeech = () => vi.stubGlobal("SpeechRecognition", FakeRecognition);
const typed = () => screen.getByTestId("value").textContent;

describe("MicButton", () => {
  it("is not shown on a phone whose browser cannot recognise speech, so typing is the only way and nothing is broken", () => {
    renderUi(<Box />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("listens in the language the app is set to", async () => {
    enableSpeech();
    renderUi(<Box />, "ta");
    await userEvent.click(screen.getByRole("button", { name: /பேசுங்கள்|Speak/ }));
    expect(FakeRecognition.last?.lang).toBe("ta-IN");
    expect(FakeRecognition.last?.started).toBe(true);
  });

  it("types what it hears after what was already typed, with one space between", async () => {
    enableSpeech();
    renderUi(<Box initial="my order" />);
    await userEvent.click(screen.getByRole("button", { name: "Speak" }));
    act(() => FakeRecognition.last?.hear("was cancelled"));
    expect(typed()).toBe("my order was cancelled");
  });

  it("shows that it is listening, and a note about where the voice goes", async () => {
    enableSpeech();
    renderUi(<Box />);
    await userEvent.click(screen.getByRole("button", { name: "Speak" }));
    expect(screen.getByRole("status")).toHaveTextContent("Listening…");
    expect(screen.getByRole("status")).toHaveTextContent(/speech service/);
    expect(screen.getByRole("button", { name: "Stop" })).toHaveAttribute("aria-pressed", "true");
  });

  it("stops when pressed again", async () => {
    enableSpeech();
    renderUi(<Box />);
    await userEvent.click(screen.getByRole("button", { name: "Speak" }));
    await userEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(FakeRecognition.last?.stopped).toBe(true);
    expect(screen.getByRole("button", { name: "Speak" })).toBeInTheDocument();
  });

  it("stops by itself when the speaker pauses", async () => {
    enableSpeech();
    renderUi(<Box />);
    await userEvent.click(screen.getByRole("button", { name: "Speak" }));
    act(() => FakeRecognition.last?.onend?.());
    expect(screen.getByRole("button", { name: "Speak" })).toBeInTheDocument();
  });

  it("explains a refused microphone", async () => {
    enableSpeech();
    renderUi(<Box />);
    await userEvent.click(screen.getByRole("button", { name: "Speak" }));
    act(() => FakeRecognition.last?.onerror?.({ error: "not-allowed" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Allow the microphone to speak.");
  });

  it("asks the worker to type when voice needs internet and there is none", async () => {
    enableSpeech();
    renderUi(<Box />);
    await userEvent.click(screen.getByRole("button", { name: "Speak" }));
    act(() => FakeRecognition.last?.onerror?.({ error: "network" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Voice needs internet. Please type.");
  });

  it("says nothing when the worker simply did not speak", async () => {
    enableSpeech();
    renderUi(<Box />);
    await userEvent.click(screen.getByRole("button", { name: "Speak" }));
    act(() => FakeRecognition.last?.onerror?.({ error: "no-speech" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("stops listening if the screen goes away", async () => {
    enableSpeech();
    const { unmount } = renderUi(<Box />);
    await userEvent.click(screen.getByRole("button", { name: "Speak" }));
    unmount();
    expect(FakeRecognition.last?.stopped).toBe(true);
  });
});
