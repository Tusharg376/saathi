import type { z } from "zod";

/**
 * Tools the model can call. A tool is a Zod schema for its arguments plus a function to run.
 * The model's arguments are untrusted: they are validated before `run` is ever called.
 */
export interface ToolDef<A extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  args: A;
  run: (args: z.infer<A>) => Promise<unknown> | unknown;
  /** If true, the call is also forwarded to the caller as a `ui_action` event (applied on the device). */
  clientAction?: boolean;
}

/**
 * Define a tool with `run` args inferred from its Zod schema. The loop validates args with
 * `safeParse` before calling `run`, so erasing the generic here (to allow a heterogeneous
 * tool list) is safe.
 */
export function defineTool<A extends z.ZodType>(def: ToolDef<A>): ToolDef {
  return def as unknown as ToolDef;
}

export type ToolLoopEvent =
  | { type: "text"; text: string }
  | { type: "tool_call"; name: string; args: unknown }
  | { type: "tool_result"; name: string; result: unknown }
  | { type: "ui_action"; name: string; args: unknown };

export interface ToolOutcome {
  /** What the model is told. Errors are results too, so the model can recover. */
  result: unknown;
  /** Set when the tool is a client action: the validated call, to forward to the UI. */
  action?: ToolLoopEvent;
}

/** Validates the model's arguments, runs the tool, and never throws: failures become results. */
export async function executeToolCall(tool: ToolDef | undefined, name: string, rawArgs: unknown): Promise<ToolOutcome> {
  if (!tool) return { result: { error: `Unknown tool: ${name}` } };

  const parsed = tool.args.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return { result: { error: `Invalid arguments: ${parsed.error.issues.map((i) => i.message).join("; ")}` } };
  }

  try {
    const result = await tool.run(parsed.data);
    return { result, action: tool.clientAction ? { type: "ui_action", name, args: parsed.data } : undefined };
  } catch (e) {
    return { result: { error: (e as Error).message || "Tool failed" } };
  }
}
