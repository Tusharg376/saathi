/**
 * The ONLY module that imports @google/genai.
 *
 * Uses the `generateContent` surface (officially "legacy but fully supported");
 * if we later move to the Interactions API, this file is the only change.
 */
import {
  GoogleGenAI,
  ThinkingLevel,
  type Content,
  type FunctionCall,
  type GenerateContentConfig,
  type GenerateContentParameters,
  type Part,
} from "@google/genai";
import { z } from "zod";
import { LlmError, LlmUnavailableError, toLlmError, withRetry } from "./errors";
import { resolveModel, usesDefaultSampling, type ModelTier } from "./models";
import { executeToolCall, type ToolDef, type ToolLoopEvent } from "./tools";

export type { Content, Part };
export { LlmError, LlmUnavailableError };
export { defineTool, type ToolDef, type ToolLoopEvent } from "./tools";

export function hasApiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

let cached: { key: string; client: GoogleGenAI } | null = null;
function getClient(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new LlmUnavailableError();
  if (!cached || cached.key !== key) cached = { key, client: new GoogleGenAI({ apiKey: key }) };
  return cached.client;
}

type Thinking = "minimal" | "low" | "medium" | "high";

export interface GenerateOptions {
  model?: ModelTier | string;
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
  thinking?: Thinking;
  signal?: AbortSignal;
}

const THINKING_LEVELS: Record<Thinking, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

function buildConfig(opts: GenerateOptions, extra: GenerateContentConfig = {}): GenerateContentConfig {
  const config: GenerateContentConfig = { ...extra };
  if (opts.system) config.systemInstruction = opts.system;
  if (opts.temperature !== undefined && !usesDefaultSampling(resolveModel(opts.model))) {
    config.temperature = opts.temperature;
  }
  if (opts.maxOutputTokens !== undefined) config.maxOutputTokens = opts.maxOutputTokens;
  if (opts.thinking) config.thinkingConfig = { thinkingLevel: THINKING_LEVELS[opts.thinking] };
  if (opts.signal) config.abortSignal = opts.signal;
  return config;
}

/** Convenience builders for message parts. */
export const userText = (text: string): Content => ({ role: "user", parts: [{ text }] });
export const modelText = (text: string): Content => ({ role: "model", parts: [{ text }] });
export const inlineData = (mimeType: string, base64: string): Part => ({ inlineData: { mimeType, data: base64 } });

/** Models this key can use for generateContent (used by `npm run smoke`). */
export async function listGenerativeModels(): Promise<string[]> {
  const ai = getClient();
  const names: string[] = [];
  try {
    const pager = await ai.models.list({ config: { pageSize: 100 } });
    for await (const m of pager) {
      const actions = m.supportedActions ?? [];
      if (m.name && (actions.length === 0 || actions.includes("generateContent"))) {
        names.push(m.name.replace(/^models\//, ""));
      }
    }
  } catch (err) {
    throw toLlmError(err);
  }
  return names.sort();
}

/** One-shot text generation. */
export async function generateText(contents: Content[] | string, opts: GenerateOptions = {}): Promise<string> {
  const ai = getClient();
  const res = await withRetry(() =>
    ai.models.generateContent({ model: resolveModel(opts.model), contents, config: buildConfig(opts) }),
  );
  return res.text ?? "";
}

/** Streaming text generation (no tools). Yields visible text chunks only. */
export async function* streamText(contents: Content[] | string, opts: GenerateOptions = {}): AsyncGenerator<string> {
  const ai = getClient();
  try {
    const stream = await ai.models.generateContentStream({
      model: resolveModel(opts.model),
      contents,
      config: buildConfig(opts),
    });
    for await (const chunk of stream) {
      if (chunk.text) yield chunk.text;
    }
  } catch (err) {
    throw toLlmError(err);
  }
}

/** Zod 4 schema -> JSON Schema without the `$schema` key Gemini does not need. */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  void _ignored;
  return rest;
}

type Parsed<S extends z.ZodType> = { ok: true; data: z.infer<S> } | { ok: false; error: string };

function tryParse<S extends z.ZodType>(schema: S, text: string): Parsed<S> {
  try {
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    const result = schema.safeParse(JSON.parse(cleaned));
    if (result.success) return { ok: true, data: result.data };
    return { ok: false, error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Structured output: the model returns JSON matching `schema`; we validate with Zod and,
 * if it does not parse, ask once more, showing the model what was wrong.
 */
export async function generateJSON<S extends z.ZodType>(
  contents: Content[] | string,
  schema: S,
  opts: GenerateOptions = {},
): Promise<z.infer<S>> {
  const ai = getClient();
  const model = resolveModel(opts.model);
  const config = buildConfig(opts, { responseMimeType: "application/json", responseJsonSchema: toJsonSchema(schema) });
  const ask = async (c: Content[] | string) =>
    (await withRetry(() => ai.models.generateContent({ model, contents: c, config }))).text ?? "";

  const first = await ask(contents);
  const parsed = tryParse(schema, first);
  if (parsed.ok) return parsed.data;

  const base: Content[] = typeof contents === "string" ? [userText(contents)] : contents;
  const retry = await ask([
    ...base,
    modelText(first),
    userText(
      `That JSON was invalid: ${parsed.error}. Reply again with ONLY valid JSON that matches the schema exactly.`,
    ),
  ]);
  const second = tryParse(schema, retry);
  if (second.ok) return second.data;
  throw new LlmError(`Model returned JSON that failed validation: ${second.error}`);
}

/* ------------------------------------------------------------------ */
/* Tool loop                                                           */
/* ------------------------------------------------------------------ */

export interface ToolLoopOptions extends GenerateOptions {
  tools: ToolDef[];
  /** Max model<->tool round trips before we force a final answer. */
  maxSteps?: number;
}

interface Turn {
  /** Every part the model produced, untouched. */
  parts: Part[];
  calls: FunctionCall[];
}

/**
 * One streamed model turn: yields visible text as it arrives and returns what the model
 * produced. Parts are kept VERBATIM so the thought signatures Gemini 3 attaches to function
 * calls can be echoed back unchanged.
 */
async function* streamTurn(ai: GoogleGenAI, request: GenerateContentParameters): AsyncGenerator<ToolLoopEvent, Turn> {
  const parts: Part[] = [];
  const calls: FunctionCall[] = [];
  try {
    const stream = await ai.models.generateContentStream(request);
    for await (const chunk of stream) {
      for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
        parts.push(part);
        if (part.functionCall) calls.push(part.functionCall);
        else if (part.text && !part.thought) yield { type: "text", text: part.text };
      }
    }
  } catch (err) {
    throw toLlmError(err);
  }
  return { parts, calls };
}

/** Runs each requested tool and returns the response parts to send back to the model. */
async function* runCalls(calls: FunctionCall[], byName: Map<string, ToolDef>): AsyncGenerator<ToolLoopEvent, Part[]> {
  const responses: Part[] = [];
  for (const call of calls) {
    const name = call.name ?? "";
    yield { type: "tool_call", name, args: call.args };
    const { result, action } = await executeToolCall(byName.get(name), name, call.args);
    if (action) yield action;
    yield { type: "tool_result", name, result };
    responses.push({ functionResponse: { name, id: call.id, response: { result } as Record<string, unknown> } });
  }
  return responses;
}

/**
 * Streams a model turn, runs any function calls, feeds the results back, and repeats until the
 * model answers without calling a tool. On the last allowed step the tools are withheld, which
 * forces a final answer instead of looping forever.
 */
export async function* runToolLoop(contents: Content[], opts: ToolLoopOptions): AsyncGenerator<ToolLoopEvent> {
  const ai = getClient();
  const model = resolveModel(opts.model);
  const maxSteps = opts.maxSteps ?? 4;
  const byName = new Map(opts.tools.map((t) => [t.name, t]));
  const functionDeclarations = opts.tools.map((t) => ({
    name: t.name,
    description: t.description,
    parametersJsonSchema: toJsonSchema(t.args),
  }));
  const history: Content[] = [...contents];

  for (let step = 0; step <= maxSteps; step++) {
    const lastStep = step === maxSteps;
    const config = buildConfig(opts, lastStep ? {} : { tools: [{ functionDeclarations }] });

    const turn = yield* streamTurn(ai, { model, contents: history, config });
    if (turn.calls.length === 0 || lastStep) return;

    history.push({ role: "model", parts: turn.parts });
    history.push({ role: "user", parts: yield* runCalls(turn.calls, byName) });
  }
}
