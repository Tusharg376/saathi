import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderUi } from "@/test/render";
import { SpeakButton } from "./SpeakButton";

class FakeUtterance {
  voice: unknown;
  lang = "";
  rate = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

/** A phone with the given voices. Each spoken chunk "finishes" on the next tick unless `hold` is set. */
function phoneWithVoices(voices: { lang: string; name: string; localService?: boolean }[], hold = false) {
  const spoken: string[] = [];
  const synth = {
    getVoices: () => voices,
    addEventListener: vi.fn(),
    cancel: vi.fn(),
    speak: vi.fn((u: FakeUtterance) => {
      spoken.push(u.text);
      if (!hold) setTimeout(() => u.onend?.(), 0);
    }),
  };
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  return { synth, spoken };
}

afterEach(() => vi.unstubAllGlobals());

describe("SpeakButton", () => {
  it("is hidden when the phone has no voice for the language, because the wrong voice is worse than silence", async () => {
    phoneWithVoices([{ lang: "en-US", name: "English" }]);
    renderUi(<SpeakButton text="नमस्ते" />, "hi");
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("is hidden when the browser cannot speak at all", () => {
    renderUi(<SpeakButton text="Hello" />, "en");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("reads the text aloud when a voice exists, without reading out links or markdown", async () => {
    const { spoken } = phoneWithVoices([{ lang: "en-IN", name: "English India", localService: true }]);
    renderUi(<SpeakButton text="**Call 108** now. See https://example.com for more." />, "en");
    await userEvent.click(await screen.findByRole("button", { name: "Listen" }));
    await waitFor(() => expect(spoken.length).toBeGreaterThan(0));
    const heard = spoken.join(" ");
    expect(heard).toContain("Call 108 now");
    expect(heard).not.toContain("https");
    expect(heard).not.toContain("*");
  });

  it("changes to Stop while speaking, and Stop cancels the speech", async () => {
    const { synth } = phoneWithVoices([{ lang: "en-IN", name: "English India" }], true);
    renderUi(<SpeakButton text="Hello there." />, "en");
    await userEvent.click(await screen.findByRole("button", { name: "Listen" }));
    const stop = await screen.findByRole("button", { name: "Stop" });
    expect(stop).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(stop);
    expect(synth.cancel).toHaveBeenCalled();
  });

  it("shows nothing for empty text", async () => {
    phoneWithVoices([{ lang: "en-IN", name: "English India" }]);
    renderUi(<SpeakButton text="   " />, "en");
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
