/**
 * Voice in and out, using the browser's built-in speech services (free, no server).
 * Support varies a lot by phone, so everything here is feature-detected and the app
 * always works by typing. Pure helpers are separated so they can be unit-tested.
 */

/* ------------------------------------------------------------------ */
/* Pure helpers                                                         */
/* ------------------------------------------------------------------ */

export interface VoiceLike {
  lang: string;
  name: string;
  localService?: boolean;
  default?: boolean;
}

/**
 * Picks the voice that best matches a BCP-47 tag like "hi-IN". Returns null when the phone has
 * no voice for the language: speaking Devanagari with an English voice produces garbage, so the
 * caller should hide the speaker button instead of playing nonsense.
 */
export function pickVoice<T extends VoiceLike>(voices: readonly T[], lang: string): T | null {
  const want = lang.toLowerCase().replace("_", "-");
  const base = want.split("-")[0];
  const norm = (v: T) => v.lang.toLowerCase().replace("_", "-");

  const exact = voices.filter((v) => norm(v) === want);
  const sameLanguage = voices.filter((v) => norm(v).split("-")[0] === base);
  const pool = exact.length ? exact : sameLanguage;
  if (pool.length === 0) return null;
  // Prefer an on-device voice: it works offline and starts instantly.
  return pool.find((v) => v.localService) ?? pool[0];
}

/**
 * Text as it should be heard: no URLs, no placeholder tokens, no markdown marks.
 * (The app's own redaction tokens like [AADHAAR] would be read out loud otherwise.)
 */
export function speechText(text: string): string {
  return (
    text
      .replace(/https?:\/\/\S+/g, "")
      .replace(/\[(?:[A-Z]+|ADD:[^\]]*)\]/g, "")
      .replace(/[*_#`>|~]/g, "")
      .trim()
      // A line break becomes a pause, but only where the sentence has not already ended.
      .replace(/([^.!?।:;,\s])[ \t]*\n\s*/g, "$1. ")
      .replace(/\s*\n\s*/g, " ")
      .replace(/\s{2,}/g, " ")
      .replace(/\.\s*\./g, ".")
      .trim()
  );
}

/**
 * Browsers cut long utterances off (Chrome stops around 15 seconds), so speak in sentence-sized
 * pieces. Splits on sentence ends (including the Devanagari danda) and keeps pieces under maxLen.
 */
export function chunkForSpeech(text: string, maxLen = 180): string[] {
  const sentences = text.match(/[^.!?।]+[.!?।]*\s*/g) ?? [text];
  const out: string[] = [];
  let current = "";

  const push = (s: string) => {
    if (s.trim()) out.push(s.trim());
  };

  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    if (s.length > maxLen) {
      // A very long sentence: split on commas, then on spaces as a last resort.
      push(current);
      current = "";
      let piece = "";
      for (const part of s.split(/(?<=[,;:])\s+|\s+/)) {
        if ((piece + " " + part).trim().length > maxLen) {
          push(piece);
          piece = part;
        } else {
          piece = (piece + " " + part).trim();
        }
      }
      push(piece);
      continue;
    }
    if ((current + " " + s).trim().length > maxLen) {
      push(current);
      current = s;
    } else {
      current = (current + " " + s).trim();
    }
  }
  push(current);
  return out;
}

/** Joins dictated text onto what is already typed, with exactly one space between. */
export function appendDictation(existing: string, spoken: string): string {
  const add = spoken.trim();
  if (!add) return existing;
  if (!existing.trim()) return add;
  return existing.replace(/\s+$/, "") + " " + add;
}

/* ------------------------------------------------------------------ */
/* Speech input (recognition)                                           */
/* ------------------------------------------------------------------ */

interface RecognitionResultList {
  length: number;
  [index: number]: { isFinal: boolean; 0: { transcript: string } };
}
interface RecognitionEventLike {
  resultIndex: number;
  results: RecognitionResultList;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const supportsSpeechInput = (): boolean => recognitionCtor() !== null;

export type DictationError = "denied" | "no_speech" | "network" | "unsupported" | "other";

export interface Dictation {
  stop(): void;
}

/**
 * Starts dictation. `onText` gets the running transcript for this utterance (interim then final).
 * Stops by itself when the speaker pauses.
 */
export function startDictation(opts: {
  lang: string;
  onText: (transcript: string, isFinal: boolean) => void;
  onEnd: () => void;
  onError: (e: DictationError) => void;
}): Dictation | null {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    opts.onError("unsupported");
    return null;
  }
  const rec = new Ctor();
  rec.lang = opts.lang;
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  rec.onresult = (e) => {
    let text = "";
    let final = false;
    for (let i = e.resultIndex; i < e.results.length; i++) {
      text += e.results[i][0].transcript;
      final = final || e.results[i].isFinal;
    }
    opts.onText(text, final);
  };
  rec.onerror = (e) => {
    const map: Record<string, DictationError> = {
      "not-allowed": "denied",
      "service-not-allowed": "denied",
      "no-speech": "no_speech",
      "aborted": "no_speech",
      network: "network",
    };
    opts.onError(map[e.error] ?? "other");
  };
  rec.onend = () => opts.onEnd();

  try {
    rec.start();
  } catch {
    opts.onError("other");
    return null;
  }
  return { stop: () => rec.stop() };
}

/* ------------------------------------------------------------------ */
/* Speech output (synthesis)                                            */
/* ------------------------------------------------------------------ */

export const supportsSpeechOutput = (): boolean => typeof window !== "undefined" && "speechSynthesis" in window;

/** Voices load asynchronously on many browsers. Resolves with whatever is available, now or soon. */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!supportsSpeechOutput()) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => resolve(synth.getVoices());
    synth.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1500); // some browsers never fire the event
  });
}

export function stopSpeaking(): void {
  if (supportsSpeechOutput()) window.speechSynthesis.cancel();
}

/** Speaks `text` in sentence-sized chunks. Cancels anything already playing. Resolves when finished or stopped. */
export async function speak(text: string, lang: string): Promise<void> {
  if (!supportsSpeechOutput()) return;
  const voice = pickVoice(await loadVoices(), lang);
  if (!voice) return; // never read Indic text with the wrong voice

  const synth = window.speechSynthesis;
  synth.cancel();
  const chunks = chunkForSpeech(speechText(text));

  await new Promise<void>((resolve) => {
    if (chunks.length === 0) return resolve();
    let i = 0;
    const next = () => {
      if (i >= chunks.length) return resolve();
      const u = new SpeechSynthesisUtterance(chunks[i++]);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = 0.95; // a touch slower than default: clearer for second-language listeners
      u.onend = next;
      u.onerror = () => resolve(); // cancel() raises an error event; treat as "stopped"
      synth.speak(u);
    };
    next();
  });
}
