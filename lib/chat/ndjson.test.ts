import { describe, expect, it } from "vitest";
import { NdjsonParser } from "./ndjson";

describe("NdjsonParser", () => {
  it("parses whole lines", () => {
    const p = new NdjsonParser();
    expect(p.push('{"a":1}\n{"b":2}\n')).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("buffers a line split across chunks", () => {
    const p = new NdjsonParser();
    expect(p.push('{"type":"te')).toEqual([]);
    expect(p.push('xt","text":"hi"}\n')).toEqual([{ type: "text", text: "hi" }]);
  });

  it("holds an incomplete trailing line until its newline arrives", () => {
    const p = new NdjsonParser();
    expect(p.push('{"a":1}\n{"b":')).toEqual([{ a: 1 }]);
    expect(p.push("2}\n")).toEqual([{ b: 2 }]);
  });

  it("flush returns a final line that has no trailing newline", () => {
    const p = new NdjsonParser();
    p.push('{"a":1}');
    expect(p.flush()).toEqual([{ a: 1 }]);
    expect(p.flush()).toEqual([]);
  });

  it("skips corrupt and blank lines without losing the good ones", () => {
    const p = new NdjsonParser();
    expect(p.push('{"a":1}\nnot json\n\n   \n{"b":2}\n')).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("survives a multi-byte Devanagari character split across network chunks", () => {
    const line = JSON.stringify({ type: "text", text: "नमस्ते दोस्त" }) + "\n";
    const bytes = new TextEncoder().encode(line);
    // Cut in the middle of a 3-byte character.
    const cut = bytes.indexOf(0xe0) + 1;
    const decoder = new TextDecoder();
    const p = new NdjsonParser();
    const out = [
      ...p.push(decoder.decode(bytes.slice(0, cut), { stream: true })),
      ...p.push(decoder.decode(bytes.slice(cut), { stream: true })),
    ];
    expect(out).toEqual([{ type: "text", text: "नमस्ते दोस्त" }]);
  });

  it("handles a stream cut into single-byte chunks", () => {
    const line = JSON.stringify({ type: "text", text: "தமிழ் ಕನ್ನಡ 😀" }) + "\n";
    const decoder = new TextDecoder();
    const p = new NdjsonParser();
    const out: unknown[] = [];
    for (const b of new TextEncoder().encode(line)) out.push(...p.push(decoder.decode(new Uint8Array([b]), { stream: true })));
    expect(out).toEqual([{ type: "text", text: "தமிழ் ಕನ್ನಡ 😀" }]);
  });
});
