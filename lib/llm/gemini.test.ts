import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

/**
 * The adapter is tested against a fake SDK, so we can check exactly what it sends to
 * Gemini and how it reacts to each kind of reply, without a key or a network.
 */
const sdk = vi.hoisted(() => ({
  generateContent: vi.fn(),
  generateContentStream: vi.fn(),
  list: vi.fn(),
  constructed: [] as unknown[],
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: sdk.generateContent, generateContentStream: sdk.generateContentStream, list: sdk.list };
    constructor(opts: unknown) {
      sdk.constructed.push(opts);
    }
  },
  ThinkingLevel: { MINIMAL: "MINIMAL", LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH" },
}));

import {
  LlmError,
  LlmUnavailableError,
  defineTool,
  generateJSON,
  generateText,
  hasApiKey,
  inlineData,
  listGenerativeModels,
  modelText,
  runToolLoop,
  streamText,
  toJsonSchema,
  userText,
  type ToolLoopEvent,
} from "./gemini";

/** A fake streamed reply made of the given chunks. */
const stream = (...chunks: unknown[]) =>
  (async function* () {
    for (const c of chunks) yield c;
  })();
const textChunk = (text: string) => ({ text, candidates: [{ content: { parts: [{ text }] } }] });
const partsChunk = (...parts: unknown[]) => ({ candidates: [{ content: { parts } }] });

const collect = async (gen: AsyncGenerator<ToolLoopEvent>) => {
  const out: ToolLoopEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
};

beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-key-not-real";
  delete process.env.GEMINI_MODEL_PRIMARY;
  delete process.env.GEMINI_MODEL_FAST;
  sdk.generateContent.mockReset();
  sdk.generateContentStream.mockReset();
  sdk.list.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.GEMINI_API_KEY;
});

describe("key handling", () => {
  it("reports whether a key is configured", () => {
    expect(hasApiKey()).toBe(true);
    delete process.env.GEMINI_API_KEY;
    expect(hasApiKey()).toBe(false);
  });

  it("refuses to call the model without a key, with a distinct error the app can recognise", async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(generateText("hi")).rejects.toBeInstanceOf(LlmUnavailableError);
    expect(sdk.generateContent).not.toHaveBeenCalled();
  });

  it("creates the client with the configured key", async () => {
    sdk.generateContent.mockResolvedValue({ text: "ok" });
    await generateText("hi");
    expect(sdk.constructed.at(-1)).toEqual({ apiKey: "test-key-not-real" });
  });
});

describe("generateText", () => {
  it("returns the model's text and sends system instruction, temperature and the abort signal", async () => {
    sdk.generateContent.mockResolvedValue({ text: "namaste" });
    const ac = new AbortController();
    const out = await generateText([userText("hello")], {
      model: "gemini-2.5-flash", // an older model still takes a custom temperature
      system: "Be kind.",
      temperature: 0.2,
      maxOutputTokens: 50,
      signal: ac.signal,
    });
    expect(out).toBe("namaste");
    const call = sdk.generateContent.mock.calls[0][0];
    expect(call.config).toMatchObject({
      systemInstruction: "Be kind.",
      temperature: 0.2,
      maxOutputTokens: 50,
      abortSignal: ac.signal,
    });
    expect(call.contents).toEqual([{ role: "user", parts: [{ text: "hello" }] }]);
  });

  it("leaves sampling at the default for Gemini 3 models, as Google advises, instead of sending a low temperature", async () => {
    sdk.generateContent.mockResolvedValue({ text: "x" });
    await generateText("a", { temperature: 0 });
    await generateText("a", { model: "gemini-3.5-flash-lite", temperature: 0.3 });
    for (const [call] of sdk.generateContent.mock.calls) expect(call.config).not.toHaveProperty("temperature");
  });

  it("uses the primary model by default, the fast tier on request, and honours env overrides", async () => {
    sdk.generateContent.mockResolvedValue({ text: "x" });
    await generateText("a");
    expect(sdk.generateContent.mock.calls[0][0].model).toBe("gemini-3.8-flash");
    await generateText("a", { model: "fast" });
    expect(sdk.generateContent.mock.calls[1][0].model).toBe("gemini-3.5-flash-lite");
    process.env.GEMINI_MODEL_PRIMARY = "my-model";
    await generateText("a");
    expect(sdk.generateContent.mock.calls[2][0].model).toBe("my-model");
    await generateText("a", { model: "explicit-id" });
    expect(sdk.generateContent.mock.calls[3][0].model).toBe("explicit-id");
  });

  it("maps the thinking option to the SDK's level", async () => {
    sdk.generateContent.mockResolvedValue({ text: "x" });
    await generateText("a", { thinking: "low" });
    expect(sdk.generateContent.mock.calls[0][0].config.thinkingConfig).toEqual({ thinkingLevel: "LOW" });
  });

  it("returns an empty string when the model returns no text", async () => {
    sdk.generateContent.mockResolvedValue({});
    expect(await generateText("a")).toBe("");
  });
});

describe("error handling and retries", () => {
  const failWith = (status: number, message = "boom") => Object.assign(new Error(message), { status });

  it("retries a rate limit, then succeeds", async () => {
    vi.useFakeTimers();
    sdk.generateContent.mockRejectedValueOnce(failWith(429)).mockResolvedValueOnce({ text: "ok" });
    const p = generateText("a");
    await vi.runAllTimersAsync();
    expect(await p).toBe("ok");
    expect(sdk.generateContent).toHaveBeenCalledTimes(2);
  });

  it("gives up after three attempts with a friendly, worker-safe message", async () => {
    vi.useFakeTimers();
    sdk.generateContent.mockRejectedValue(failWith(429, "RESOURCE_EXHAUSTED secret detail"));
    const p = generateText("a").catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    const err = (await p) as LlmError;
    expect(err).toBeInstanceOf(LlmError);
    expect(err.status).toBe(429);
    expect(err.message).toMatch(/try again/i);
    expect(err.message).not.toMatch(/secret|RESOURCE_EXHAUSTED/);
    expect(sdk.generateContent).toHaveBeenCalledTimes(3);
  });

  it("retries server errors but not bad requests", async () => {
    vi.useFakeTimers();
    sdk.generateContent.mockRejectedValue(failWith(503));
    const busy = generateText("a").catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    expect(((await busy) as LlmError).message).toMatch(/busy/i);
    expect(sdk.generateContent).toHaveBeenCalledTimes(3);

    sdk.generateContent.mockReset();
    sdk.generateContent.mockRejectedValue(failWith(400));
    const bad = (await generateText("a").catch((e: unknown) => e)) as LlmError;
    expect(sdk.generateContent).toHaveBeenCalledTimes(1);
    expect(bad.status).toBe(400);
    expect(bad.message).toMatch(/API key and model name/);
  });

  it("does not wrap an abort: callers need to see it as an abort", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    sdk.generateContent.mockRejectedValue(abort);
    await expect(generateText("a")).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("generateJSON", () => {
  const Schema = z.object({ platform: z.string(), amount: z.number() });

  it("parses valid JSON and asks the model for JSON in the schema, without the $schema key", async () => {
    sdk.generateContent.mockResolvedValue({ text: '{"platform":"Swiggy","amount":1850}' });
    expect(await generateJSON("x", Schema)).toEqual({ platform: "Swiggy", amount: 1850 });
    const config = sdk.generateContent.mock.calls[0][0].config;
    expect(config.responseMimeType).toBe("application/json");
    expect(config.responseJsonSchema).toMatchObject({ type: "object", required: ["platform", "amount"] });
    expect(config.responseJsonSchema).not.toHaveProperty("$schema");
  });

  it("tolerates a code fence around the JSON", async () => {
    sdk.generateContent.mockResolvedValue({ text: '```json\n{"platform":"Zomato","amount":5}\n```' });
    expect(await generateJSON("x", Schema)).toEqual({ platform: "Zomato", amount: 5 });
  });

  it("repairs once: sends the model the validation error and accepts a corrected reply", async () => {
    sdk.generateContent
      .mockResolvedValueOnce({ text: '{"platform":"Swiggy","amount":"lots"}' })
      .mockResolvedValueOnce({ text: '{"platform":"Swiggy","amount":10}' });
    expect(await generateJSON("x", Schema)).toEqual({ platform: "Swiggy", amount: 10 });
    const repair = sdk.generateContent.mock.calls[1][0].contents;
    expect(repair.at(-1).parts[0].text).toMatch(/invalid/i);
    expect(repair.at(-2)).toEqual(modelText('{"platform":"Swiggy","amount":"lots"}'));
  });

  it("fails clearly after one repair attempt rather than looping", async () => {
    sdk.generateContent.mockResolvedValue({ text: "not json at all" });
    await expect(generateJSON("x", Schema)).rejects.toThrow(/failed validation/);
    expect(sdk.generateContent).toHaveBeenCalledTimes(2);
  });
});

describe("streamText", () => {
  it("yields each chunk's text and skips empty ones", async () => {
    sdk.generateContentStream.mockResolvedValue(stream(textChunk("Hel"), { text: "" }, textChunk("lo")));
    const out: string[] = [];
    for await (const t of streamText("hi")) out.push(t);
    expect(out).toEqual(["Hel", "lo"]);
  });

  it("converts provider failures into worker-safe errors", async () => {
    sdk.generateContentStream.mockRejectedValue(Object.assign(new Error("internal"), { status: 503 }));
    const run = async () => {
      for await (const t of streamText("hi")) void t;
    };
    await expect(run()).rejects.toMatchObject({ name: "LlmError", status: 503 });
  });
});

describe("listGenerativeModels", () => {
  it("returns sorted names without the models/ prefix, only for models that can generate content", async () => {
    sdk.list.mockResolvedValue(
      (async function* () {
        yield { name: "models/zeta", supportedActions: ["generateContent"] };
        yield { name: "models/alpha", supportedActions: ["generateContent", "countTokens"] };
        yield { name: "models/embed", supportedActions: ["embedContent"] };
        yield { name: "models/legacy" }; // no action list: assume usable
      })(),
    );
    expect(await listGenerativeModels()).toEqual(["alpha", "legacy", "zeta"]);
  });
});

describe("helpers", () => {
  it("toJsonSchema drops $schema", () => {
    expect(toJsonSchema(z.object({ a: z.string() }))).not.toHaveProperty("$schema");
  });
  it("builds content parts", () => {
    expect(userText("a")).toEqual({ role: "user", parts: [{ text: "a" }] });
    expect(modelText("b")).toEqual({ role: "model", parts: [{ text: "b" }] });
    expect(inlineData("image/png", "AAA")).toEqual({ inlineData: { mimeType: "image/png", data: "AAA" } });
  });
});

describe("runToolLoop", () => {
  const calc = defineTool({
    name: "calc",
    description: "Multiply",
    args: z.object({ a: z.number(), b: z.number() }),
    run: ({ a, b }) => ({ product: a * b }),
  });
  const opts = (extra = {}) => ({ tools: [calc], ...extra });

  it("streams plain text when the model calls no tools", async () => {
    sdk.generateContentStream.mockResolvedValue(stream(partsChunk({ text: "Hello " }), partsChunk({ text: "there" })));
    expect(await collect(runToolLoop([userText("hi")], opts()))).toEqual([
      { type: "text", text: "Hello " },
      { type: "text", text: "there" },
    ]);
    expect(sdk.generateContentStream).toHaveBeenCalledTimes(1);
  });

  it("offers the tools to the model as function declarations", async () => {
    sdk.generateContentStream.mockResolvedValue(stream(partsChunk({ text: "ok" })));
    await collect(runToolLoop([userText("hi")], opts()));
    const decl = sdk.generateContentStream.mock.calls[0][0].config.tools[0].functionDeclarations[0];
    expect(decl).toMatchObject({ name: "calc", description: "Multiply" });
    expect(decl.parametersJsonSchema).toMatchObject({ type: "object" });
  });

  it("runs a tool, returns the result to the model, and streams the final answer", async () => {
    const callPart = { functionCall: { id: "c1", name: "calc", args: { a: 17, b: 2350 } }, thoughtSignature: "SIG" };
    sdk.generateContentStream
      .mockResolvedValueOnce(stream(partsChunk(callPart)))
      .mockResolvedValueOnce(stream(partsChunk({ text: "It is 39950." })));

    const events = await collect(runToolLoop([userText("17 of 2350?")], opts()));
    expect(events.map((e) => e.type)).toEqual(["tool_call", "tool_result", "text"]);
    expect(events[1]).toEqual({ type: "tool_result", name: "calc", result: { product: 39950 } });

    // The second request must carry the model's turn VERBATIM (Gemini 3 needs the thought signature back)
    // followed by our function response, tagged with the same call id.
    const history = sdk.generateContentStream.mock.calls[1][0].contents;
    expect(history.at(-2)).toEqual({ role: "model", parts: [callPart] });
    expect(history.at(-1)).toEqual({
      role: "user",
      parts: [{ functionResponse: { name: "calc", id: "c1", response: { result: { product: 39950 } } } }],
    });
  });

  it("never runs a tool with invalid arguments: the model is told what was wrong", async () => {
    const run = vi.fn();
    const strict = defineTool({ name: "calc", description: "d", args: z.object({ a: z.number() }), run });
    sdk.generateContentStream
      .mockResolvedValueOnce(stream(partsChunk({ functionCall: { name: "calc", args: { a: "NaN" } } })))
      .mockResolvedValueOnce(stream(partsChunk({ text: "sorry" })));
    const events = await collect(runToolLoop([userText("x")], { tools: [strict] }));
    expect(run).not.toHaveBeenCalled();
    expect((events.find((e) => e.type === "tool_result") as { result: { error: string } }).result.error).toMatch(
      /Invalid arguments/,
    );
  });

  it("reports an unknown tool and a throwing tool to the model instead of crashing", async () => {
    const boom = defineTool({
      name: "boom",
      description: "d",
      args: z.object({}),
      run: () => {
        throw new Error("kaboom");
      },
    });
    sdk.generateContentStream
      .mockResolvedValueOnce(
        stream(partsChunk({ functionCall: { name: "ghost", args: {} } }, { functionCall: { name: "boom", args: {} } })),
      )
      .mockResolvedValueOnce(stream(partsChunk({ text: "done" })));
    const results = (await collect(runToolLoop([userText("x")], { tools: [boom] }))).filter(
      (e) => e.type === "tool_result",
    ) as {
      result: { error: string };
    }[];
    expect(results[0].result.error).toMatch(/Unknown tool: ghost/);
    expect(results[1].result.error).toBe("kaboom");
  });

  it("forwards a client-action tool to the caller as a ui_action", async () => {
    const propose = defineTool({
      name: "propose",
      description: "d",
      args: z.object({ x: z.number() }),
      run: () => ({ shown: true }),
      clientAction: true,
    });
    sdk.generateContentStream
      .mockResolvedValueOnce(stream(partsChunk({ functionCall: { name: "propose", args: { x: 7 } } })))
      .mockResolvedValueOnce(stream(partsChunk({ text: "ok" })));
    const events = await collect(runToolLoop([userText("x")], { tools: [propose] }));
    expect(events).toContainEqual({ type: "ui_action", name: "propose", args: { x: 7 } });
  });

  it("stops after maxSteps and forces a final answer by withholding the tools", async () => {
    const again = () => stream(partsChunk({ functionCall: { name: "calc", args: { a: 1, b: 1 } } }));
    sdk.generateContentStream.mockImplementation(async () => again());
    await collect(runToolLoop([userText("loop")], opts({ maxSteps: 2 })));
    expect(sdk.generateContentStream).toHaveBeenCalledTimes(3);
    expect(sdk.generateContentStream.mock.calls[2][0].config.tools).toBeUndefined();
    expect(sdk.generateContentStream.mock.calls[0][0].config.tools).toBeDefined();
  });

  it("does not show the model's private thoughts as text", async () => {
    sdk.generateContentStream.mockResolvedValue(
      stream(partsChunk({ text: "secret reasoning", thought: true }, { text: "Answer." })),
    );
    expect(await collect(runToolLoop([userText("x")], opts()))).toEqual([{ type: "text", text: "Answer." }]);
  });

  it("turns a stream failure into a worker-safe error", async () => {
    sdk.generateContentStream.mockRejectedValue(Object.assign(new Error("internal"), { status: 500 }));
    await expect(collect(runToolLoop([userText("x")], opts()))).rejects.toMatchObject({ name: "LlmError" });
  });

  it("does not mutate the caller's message list", async () => {
    sdk.generateContentStream
      .mockResolvedValueOnce(stream(partsChunk({ functionCall: { name: "calc", args: { a: 1, b: 2 } } })))
      .mockResolvedValueOnce(stream(partsChunk({ text: "3" })));
    const mine = [userText("x")];
    await collect(runToolLoop(mine, opts()));
    expect(mine).toHaveLength(1);
  });
});
