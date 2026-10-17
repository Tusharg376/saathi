import type { ChatAction, ChatErrorCode, ChatEvent } from "../agent/events";
import { detectEmergency } from "../safety/emergency";

/** An error the chat screen can show: anything the server reports, plus "no connection at all". */
export type UiError = ChatErrorCode | "offline";

export interface EmergencyInfo {
  severity: "urgent" | "possible";
  helplines: string[];
}

/** One message on screen. An assistant message is filled in event by event as the answer streams. */
export interface Msg {
  id: string;
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
  /** The tool the assistant is using right now, for the "Checking schemes…" line. */
  tool?: string;
  sources?: string[];
  fallback?: string[];
  emergency?: EmergencyInfo;
  piiHidden?: boolean;
  error?: UiError;
  actions?: ChatAction[];
}

/** Never let a "possible" alert replace an "urgent" one. */
function mergeEmergency(current: EmergencyInfo | undefined, next: EmergencyInfo): EmergencyInfo {
  return current?.severity === "urgent" && next.severity === "possible" ? current : next;
}

/** Folds one streamed event into the assistant message it belongs to. Pure, so it is easy to test. */
export function applyEvent(m: Msg, e: ChatEvent): Msg {
  switch (e.type) {
    case "emergency":
      return { ...m, emergency: mergeEmergency(m.emergency, { severity: e.severity, helplines: e.helplines }) };
    case "notice":
      return { ...m, piiHidden: true };
    case "tool":
      return { ...m, tool: e.name };
    case "text":
      return { ...m, text: m.text + e.text, tool: undefined };
    case "action":
      return { ...m, actions: [...(m.actions ?? []), e.action] };
    case "sources":
      return { ...m, sources: e.ids };
    case "fallback":
      return { ...m, fallback: e.ids };
    case "error":
      return { ...m, error: e.code };
    case "done":
      return m;
  }
}

export const MAX_HISTORY = 12;

/** The recent turns to send as context: real text only, no failed turns. */
export function toHistory(messages: Msg[]): { role: "user" | "assistant"; text: string }[] {
  return messages
    .filter((m) => m.text.trim() && !m.error)
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, text: m.text }));
}

/**
 * The emergency verdict from the device itself, available instantly and offline, before any
 * network call. The server's verdict can only add to it, never lower it (see applyEvent).
 */
export function localEmergency(text: string): EmergencyInfo | undefined {
  const r = detectEmergency(text);
  return r.severity ? { severity: r.severity, helplines: r.helplines } : undefined;
}
