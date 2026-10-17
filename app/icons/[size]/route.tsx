import { ImageResponse } from "next/og";
import { IconArt } from "@/lib/pwa/icon";

/** PNGs the web app manifest points at: /icons/192, /icons/512 (also used as the maskable icon). */
const SIZES = [192, 512] as const;

export function generateStaticParams() {
  return SIZES.map((s) => ({ size: String(s) }));
}

export async function GET(_request: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size } = await ctx.params;
  const px = Number(size);
  if (!SIZES.includes(px as (typeof SIZES)[number])) return new Response("Not found", { status: 404 });
  return new ImageResponse(<IconArt size={px} />, { width: px, height: px });
}
