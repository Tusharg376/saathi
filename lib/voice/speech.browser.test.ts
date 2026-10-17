// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadVoices,
  speak,
  startDictation,
  stopSpeaking,
  supportsSpeechInput,
  supportsSpeechOutput,
  type DictationError,
} from "./speech";

/** A stand-in for the browser's speech recognition that the test can drive. */
class FakeRecognition {
  static last: FakeRecognition;
  static startFails = false;
  lang = "";
  continuous = true;
  interimResults = false;
  maxAlternatives = 0;
  stopped = false;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {
    if (FakeRecognition.startFails) throw new Error("InvalidStateError: already started");
  }
  stop() {
    this.stopped = true;
    this.onend?.();
  }
  hear(parts: { text: string; final?: boolean }[], resultIndex = 0) {
    const results = Object.assign(
      parts.map((p) => ({ isFinal: Boolean(p.final), 0: { transcript: p.text } })),
      {},
    );
    this.onresult?.({ resultIndex, results });
  }
}

function dictate() {
  const heard: { text: string; final: boolean }[] = [];
  const errors: DictationError[] = [];
  const onEnd = vi.fn();
  const session = startDictation({
    lang: "hi-IN",
    onText: (text, final) => heard.push({ text, final }),
    onEnd,
    onError: (e) => errors.push(e),
  });
  return { session, heard, errors, onEnd };
}

beforeEach(() => {
  FakeRecognition.startFails = false;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("startDictation (speaking instead of typing)", () => {
  it("reports that voice typing is unavailable on a browser without it, instead of failing silently", () => {
    expect(supportsSpeechInput()).toBe(false);
    const { session, errors } = dictate();
    expect(session).toBeNull();
    expect(errors).toEqual(["unsupported"]);
  });

  it("works with the prefixed version Chrome and Safari provide", () => {
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
    expect(supportsSpeechInput()).toBe(true);
    expect(dictate().session).not.toBeNull();
  });

  it("listens in the given language, for one sentence at a time, showing words as they are heard", () => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    dictate();
    expect(FakeRecognition.last).toMatchObject({
      lang: "hi-IN",
      continuous: false,
      interimResults: true,
      maxAlternatives: 1,
    });
  });

  it("passes on the running transcript, marking when the browser is sure of it", () => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    const { heard } = dictate();
    FakeRecognition.last.hear([{ text: "mera order" }]);
    FakeRecognition.last.hear([{ text: "mera order cancel ho gaya", final: true }]);
    expect(heard).toEqual([
      { text: "mera order", final: false },
      { text: "mera order cancel ho gaya", final: true },
    ]);
  });

  it("only reports the new part when the browser sends several results at once", () => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    const { heard } = dictate();
    FakeRecognition.last.hear([{ text: "already heard ", final: true }, { text: "and this is new" }], 1);
    expect(heard).toEqual([{ text: "and this is new", final: false }]);
  });

  it.each([
    ["not-allowed", "denied"],
    ["service-not-allowed", "denied"],
    ["no-speech", "no_speech"],
    ["aborted", "no_speech"],
    ["network", "network"],
    ["audio-capture", "other"],
    ["something-new", "other"],
  ])("turns the browser's '%s' problem into '%s' for the screen to word", (browserError, expected) => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    const { errors } = dictate();
    FakeRecognition.last.onerror?.({ error: browserError });
    expect(errors).toEqual([expected]);
  });

  it("reports a microphone that is busy or already listening, and hands back nothing to stop", () => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    FakeRecognition.startFails = true;
    const { session, errors } = dictate();
    expect(session).toBeNull();
    expect(errors).toEqual(["other"]);
  });

  it("stops on request and tells the screen it has ended", () => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    const { session, onEnd } = dictate();
    session?.stop();
    expect(FakeRecognition.last.stopped).toBe(true);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});

/* ---------------------------------------------------------------- speaking out loud */

class FakeUtterance {
  voice: unknown;
  lang = "";
  rate = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}
type Voice = { lang: string; name: string; localService?: boolean };

/** A phone's speech engine. `finish` is how a chunk "ends"; `fail` is what happens when speech is cancelled. */
function engine(voices: Voice[] | (() => Voice[]) = [], { autoFinish = true } = {}) {
  const spoken: FakeUtterance[] = [];
  const listeners: Record<string, () => void> = {};
  const synth = {
    getVoices: () => (typeof voices === "function" ? voices() : voices),
    addEventListener: vi.fn((name: string, fn: () => void) => void (listeners[name] = fn)),
    cancel: vi.fn(),
    speak: vi.fn((u: FakeUtterance) => {
      spoken.push(u);
      if (autoFinish) setTimeout(() => u.onend?.(), 0);
    }),
  };
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  return { synth, spoken, listeners };
}

describe("loadVoices", () => {
  it("has nothing to offer on a browser that cannot speak", async () => {
    expect(supportsSpeechOutput()).toBe(false);
    expect(await loadVoices()).toEqual([]);
  });

  it("returns the voices straight away when the phone already has them", async () => {
    engine([{ lang: "hi-IN", name: "Hindi" }]);
    expect(await loadVoices()).toHaveLength(1);
  });

  it("waits for voices that load a moment after the page opens", async () => {
    let ready = false;
    const { listeners } = engine(() => (ready ? [{ lang: "hi-IN", name: "Hindi" }] : []));
    const pending = loadVoices();
    ready = true;
    listeners.voiceschanged();
    expect(await pending).toHaveLength(1);
  });

  it("gives up waiting after a moment on a browser that never announces its voices", async () => {
    vi.useFakeTimers();
    engine([]);
    const pending = loadVoices();
    await vi.advanceTimersByTimeAsync(1600);
    expect(await pending).toEqual([]);
  });
});

describe("stopSpeaking", () => {
  it("cancels anything being read out", () => {
    const { synth } = engine();
    stopSpeaking();
    expect(synth.cancel).toHaveBeenCalledTimes(1);
  });

  it("does nothing, without an error, where speech is not available", () => {
    expect(() => stopSpeaking()).not.toThrow();
  });
});

describe("speak", () => {
  it("says nothing at all on a browser that cannot speak", async () => {
    await expect(speak("Hello", "en-IN")).resolves.toBeUndefined();
  });

  it("stays silent rather than read Hindi with an English voice", async () => {
    const { spoken } = engine([{ lang: "en-US", name: "English" }]);
    await speak("नमस्ते, आपका भुगतान बाकी है।", "hi-IN");
    expect(spoken).toHaveLength(0);
  });

  it("reads sentence by sentence with the matching voice, a little slower than normal", async () => {
    const hindi = { lang: "hi-IN", name: "Hindi", localService: true };
    const { spoken } = engine([{ lang: "en-US", name: "English" }, hindi]);
    await speak("पहला वाक्य यहाँ है। दूसरा वाक्य यहाँ है।".repeat(8), "hi-IN");
    expect(spoken.length).toBeGreaterThan(1);
    for (const u of spoken) {
      expect(u.voice).toBe(hindi);
      expect(u.lang).toBe("hi-IN");
      expect(u.rate).toBe(0.95);
    }
  });

  it("speaks the pieces in order, one after another, never over each other", async () => {
    const { spoken } = engine([{ lang: "en-IN", name: "English India" }], { autoFinish: false });
    const done = speak("First sentence goes here. ".repeat(10) + "Last one.", "en-IN");
    await vi.waitFor(() => expect(spoken).toHaveLength(1));
    expect(spoken).toHaveLength(1); // the second piece waits for the first to end

    for (let i = 0; i < spoken.length; i++) spoken[i].onend?.(); // each ending starts the next piece
    await done;

    expect(spoken.length).toBeGreaterThan(1);
    expect(spoken.map((u) => u.text).join(" ")).toContain("Last one.");
    expect(spoken.at(-1)?.text).toContain("Last one."); // in order: the last piece is spoken last
  });

  it("cancels whatever was being read before starting something new", async () => {
    const { synth } = engine([{ lang: "en-IN", name: "English India" }]);
    await speak("Hello there.", "en-IN");
    expect(synth.cancel).toHaveBeenCalled();
  });

  it("does not read out web links or formatting marks", async () => {
    const { spoken } = engine([{ lang: "en-IN", name: "English India" }]);
    await speak("**Call 108** now. See https://example.com/help for more.", "en-IN");
    expect(spoken.map((u) => u.text).join(" ")).toBe("Call 108 now. See for more.");
  });

  it("finishes quietly when there is nothing left to read once links and marks are removed", async () => {
    const { spoken } = engine([{ lang: "en-IN", name: "English India" }]);
    await speak("https://example.com/only-a-link", "en-IN");
    expect(spoken).toHaveLength(0);
  });

  it("treats an interrupted reading as stopped, so the screen's Listen button comes back", async () => {
    const { spoken } = engine([{ lang: "en-IN", name: "English India" }], { autoFinish: false });
    const done = speak("Hello there. How are you today?", "en-IN");
    await vi.waitFor(() => expect(spoken).toHaveLength(1));
    spoken[0].onerror?.(); // what cancel() causes in most browsers
    await expect(done).resolves.toBeUndefined();
  });
});
