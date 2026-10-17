/**
 * Incremental newline-delimited JSON parser. Network chunks can split a line
 * anywhere (even inside a multi-byte character, which TextDecoder's stream mode
 * handles upstream), so we buffer until a full line arrives.
 */
export class NdjsonParser {
  private buffer = "";

  /** Feed decoded text; returns every complete event found so far. */
  push(text: string): unknown[] {
    this.buffer += text;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? ""; // last piece may be an incomplete line
    return lines.flatMap(parseLine);
  }

  /** Call once at end of stream for a final line with no trailing newline. */
  flush(text = ""): unknown[] {
    const rest = this.buffer + text;
    this.buffer = "";
    return parseLine(rest);
  }
}

function parseLine(line: string): unknown[] {
  const trimmed = line.trim();
  if (!trimmed) return [];
  try {
    return [JSON.parse(trimmed)];
  } catch {
    return []; // a corrupt line must not kill the whole stream
  }
}
