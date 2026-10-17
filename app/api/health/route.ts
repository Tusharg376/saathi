import { connection } from "next/server";
import { hasApiKey } from "@/lib/llm/gemini";
import { json } from "@/lib/server/http";

/**
 * Tells whoever runs or reviews the app whether the AI side is switched on, without exposing the key.
 * The rest of the app works either way: this is how to tell which mode you are looking at.
 */
export async function GET() {
  // Without this, Next.js would answer once while building and serve that same answer forever.
  await connection();
  const ai = hasApiKey();
  return json({ ok: true, ai: ai ? "configured" : "not_configured" });
}
