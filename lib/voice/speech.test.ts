import { describe, expect, it } from "vitest";
import { appendDictation, chunkForSpeech, pickVoice, speechText, type VoiceLike } from "./speech";

const v = (lang: string, name = lang, localService = false): VoiceLike => ({ lang, name, localService });

describe("pickVoice", () => {
  it("prefers an exact language-region match", () => {
    const voices = [v("en-US", "US"), v("hi-IN", "Hindi"), v("en-IN", "Indian English")];
    expect(pickVoice(voices, "hi-IN")?.name).toBe("Hindi");
    expect(pickVoice(voices, "en-IN")?.name).toBe("Indian English");
  });

  it("falls back to the same language in another region", () => {
    expect(pickVoice([v("ta-LK", "Sri Lankan Tamil")], "ta-IN")?.name).toBe("Sri Lankan Tamil");
  });

  it("returns null when the phone has no voice for the language, so we never read Indic text with the wrong voice", () => {
    expect(pickVoice([v("en-US"), v("en-GB")], "hi-IN")).toBeNull();
    expect(pickVoice([], "ta-IN")).toBeNull();
  });

  it("prefers an on-device voice (works offline, starts instantly)", () => {
    const voices = [v("hi-IN", "Cloud", false), v("hi-IN", "Local", true)];
    expect(pickVoice(voices, "hi-IN")?.name).toBe("Local");
  });

  it("tolerates underscores and case in tags", () => {
    expect(pickVoice([v("hi_IN", "Hindi")], "HI-in")?.name).toBe("Hindi");
  });

  it("does not match a different language that shares a prefix", () => {
    expect(pickVoice([v("hil-PH"), v("his-IN")], "hi-IN")).toBeNull();
  });
});

describe("speechText", () => {
  it("removes URLs", () => {
    expect(speechText("See https://eshram.gov.in/ for details.")).toBe("See for details.");
  });

  it("never reads redaction or gap tokens aloud", () => {
    expect(speechText("My number is [PHONE] and [AADHAAR]. Fill [ADD: order id].")).not.toMatch(/PHONE|AADHAAR|ADD/);
  });

  it("strips markdown marks that would be read as words", () => {
    expect(speechText("**Bold** and # heading and `code`")).toBe("Bold and heading and code");
  });

  it("turns line breaks into pauses", () => {
    expect(speechText("Step one\nStep two")).toBe("Step one. Step two");
  });

  it("keeps Devanagari and the danda intact", () => {
    expect(speechText("नमस्ते। आप कैसे हैं?")).toBe("नमस्ते। आप कैसे हैं?");
  });

  it("returns an empty string for nothing speakable", () => {
    expect(speechText("   \n  ")).toBe("");
    expect(speechText("[PHONE]")).toBe("");
  });

  it("does not add a stray pause at the start or end, or after a sentence that already ended", () => {
    expect(speechText("\nHello there\n")).toBe("Hello there");
    expect(speechText("Are you hurt?\nCall 108.")).toBe("Are you hurt? Call 108.");
    expect(speechText("One.\n\nTwo.")).toBe("One. Two.");
  });
});

describe("chunkForSpeech", () => {
  it("keeps a short text as one chunk", () => {
    expect(chunkForSpeech("Hello there. How are you?")).toEqual(["Hello there. How are you?"]);
  });

  it("splits on sentence ends once past the limit", () => {
    const s = "First sentence is here. Second sentence follows it. Third one ends now.";
    const chunks = chunkForSpeech(s, 40);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 40)).toBe(true);
    expect(chunks.join(" ")).toBe(s);
  });

  it("splits Hindi at the danda, not only at full stops", () => {
    const hindi = "यह पहला वाक्य है। यह दूसरा वाक्य है। यह तीसरा वाक्य है।";
    const chunks = chunkForSpeech(hindi, 25);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(" ")).toBe(hindi);
  });

  it("breaks a single very long sentence on commas then spaces, never exceeding the limit", () => {
    const long = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    const chunks = chunkForSpeech(long, 50);
    expect(chunks.every((c) => c.length <= 50)).toBe(true);
    expect(chunks.join(" ")).toBe(long);
  });

  it("loses no words when splitting at commas", () => {
    const text = "alpha beta gamma, delta epsilon zeta, eta theta iota, kappa lambda mu";
    const chunks = chunkForSpeech(text, 30);
    expect(chunks.join(" ").replace(/\s+/g, " ")).toBe(text);
  });

  it("returns nothing for empty input", () => {
    expect(chunkForSpeech("")).toEqual([]);
    expect(chunkForSpeech("   ")).toEqual([]);
  });
});

describe("appendDictation", () => {
  it("adds spoken text after what is typed with one space", () => {
    expect(appendDictation("Swiggy ne", "payout nahi diya")).toBe("Swiggy ne payout nahi diya");
    expect(appendDictation("Swiggy ne   ", "  payout nahi diya  ")).toBe("Swiggy ne payout nahi diya");
  });
  it("uses just the spoken text when nothing is typed", () => {
    expect(appendDictation("", "hello")).toBe("hello");
    expect(appendDictation("   ", "hello")).toBe("hello");
  });
  it("leaves the text alone when nothing was heard", () => {
    expect(appendDictation("typed", "  ")).toBe("typed");
  });
});
