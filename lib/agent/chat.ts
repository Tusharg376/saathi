import { todayISO } from "../earnings/dates";
import { LlmError, LlmUnavailableError, hasApiKey, runToolLoop, type Content, type ToolLoopEvent } from "../llm/gemini";
import { detectEmergency } from "../safety/emergency";
import { redactPII } from "../safety/pii";
import { searchKb } from "../kb/search";
import { toChatAction } from "./actions";
import type { ChatEvent, ChatRequest } from "./events";
import { buildSystemPrompt } from "./prompt";
import { buildTools, sourceIdsFrom } from "./tools";

type Message = ChatRequest["messages"][number];

/**
 * One chat turn as a stream of events. The order is deliberate:
 *  1. emergency check (plain rules, no AI) comes out before anything else
 *  2. PII is removed, so the model never sees Aadhaar, PAN, account numbers and the like
 *  3. with no API key we still help, from the on-device knowledge base
 *  4. otherwise the model and its tools run, streamed
 */
export async function* runChat(req: ChatRequest, opts: { signal?: AbortSignal } = {}): AsyncGenerator<ChatEvent> {
  const lastUser = [...req.messages].reverse().find((m) => m.role === "user");
  if (!lastUser) {
    yield { type: "error", code: "bad_request", message: "No user message" };
    return;
  }

  // Emergency detection reads the raw text, before redaction.
  const emergency = detectEmergency(lastUser.text);
  if (emergency.severity) {
    yield { type: "emergency", severity: emergency.severity, kinds: emergency.kinds, helplines: emergency.helplines };
  }

  const { messages, found } = redactMessages(req.messages);
  if (found.length) yield { type: "notice", code: "pii_redacted", found };

  if (!hasApiKey()) {
    yield* withoutAi(req, lastUser.text);
    return;
  }
  yield* withModel(req, messages, emergency.severity === "urgent", opts.signal);
}

/** Removes personal identifiers from every user turn. Returns the labels found, never the values. */
function redactMessages(messages: Message[]): { messages: Message[]; found: string[] } {
  const found = new Set<string>();
  const clean = messages.map((m) => {
    if (m.role !== "user") return m;
    const r = redactPII(m.text);
    r.found.forEach((f) => found.add(f));
    return { ...m, text: r.text };
  });
  return { messages: clean, found: [...found] };
}

/** No key: answer from the bundled knowledge base so the worker still gets something useful. */
async function* withoutAi(req: ChatRequest, question: string): AsyncGenerator<ChatEvent> {
  const ids = searchKb(question, { state: req.profile?.state, limit: 3 }).map((h) => h.entry.id);
  if (ids.length) yield { type: "fallback", ids };
  yield { type: "error", code: "no_key", message: "AI is not set up on this server (GEMINI_API_KEY missing)." };
  yield { type: "done" };
}

async function* withModel(
  req: ChatRequest,
  messages: Message[],
  urgent: boolean,
  signal?: AbortSignal,
): AsyncGenerator<ChatEvent> {
  const today = req.today ?? todayISO();
  const system = buildSystemPrompt({ lang: req.lang, profile: req.profile, urgent, today });
  const loop = runToolLoop(toContents(messages), { system, tools: buildTools(req.profile), model: "primary", signal });

  const sources = new Set<string>();
  let wrote = false;
  try {
    for await (const ev of loop) {
      const out = toChatEvent(ev, today, sources);
      if (out) wrote ||= out.type === "text" || out.type === "action";
      if (out) yield out;
    }
  } catch (err) {
    if (signal?.aborted) return;
    yield errorEvent(err);
    yield { type: "done" };
    return;
  }

  if (!wrote) yield { type: "error", code: "llm_error", message: "The assistant did not reply. Please try again." };
  else if (sources.size) yield { type: "sources", ids: [...sources] };
  yield { type: "done" };
}

/** What the worker's screen should hear about one step of the model loop (or nothing). */
function toChatEvent(ev: ToolLoopEvent, today: string, sources: Set<string>): ChatEvent | null {
  switch (ev.type) {
    case "text":
      return { type: "text", text: ev.text };
    case "tool_call":
      return { type: "tool", name: ev.name };
    case "tool_result":
      sourceIdsFrom(ev.name, ev.result).forEach((id) => sources.add(id));
      return null;
    case "ui_action": {
      const action = toChatAction(ev.name, ev.args, today);
      return action ? { type: "action", action } : null;
    }
  }
}

/** Worker-safe error event. Unexpected exceptions are logged with IDs removed and never shown. */
function errorEvent(err: unknown): ChatEvent {
  if (err instanceof LlmUnavailableError) return { type: "error", code: "no_key", message: err.message };
  if (err instanceof LlmError) {
    return { type: "error", code: err.status === 429 ? "rate_limited" : "llm_error", message: err.message };
  }
  console.error("chat failure:", redactPII(String((err as Error)?.message ?? err)).text);
  return { type: "error", code: "llm_error", message: "Something went wrong. Please try again." };
}

/** Gemini wants a user turn first and tolerates no empty turns. Merge consecutive same-role turns. */
export function toContents(messages: Message[]): Content[] {
  const out: Content[] = [];
  for (const m of messages) {
    const role = m.role === "user" ? "user" : "model";
    const text = m.text.trim();
    if (!text) continue;
    if (out.length === 0 && role === "model") continue; // must start with the user
    const prev = out[out.length - 1];
    if (prev && prev.role === role) {
      prev.parts = [{ text: `${prev.parts?.map((p) => p.text).join("") ?? ""}\n${text}` }];
    } else {
      out.push({ role, parts: [{ text }] });
    }
  }
  return out;
}
