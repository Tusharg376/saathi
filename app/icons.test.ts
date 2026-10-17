import { describe, expect, it } from "vitest";
import AppleIcon, { contentType as appleType, size as appleSize } from "./apple-icon";
import Icon, { contentType, size } from "./icon";
import { GET, generateStaticParams } from "./icons/[size]/route";

/** The width and height written in a PNG file's header, or null if the bytes are not a PNG. */
async function pngSize(res: Response): Promise<{ width: number; height: number } | null> {
  const bytes = new Uint8Array(await res.arrayBuffer());
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!signature.every((b, i) => bytes[i] === b)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

const sized = (px: string) => GET(new Request(`http://x/icons/${px}`), { params: Promise.resolve({ size: px }) });

describe("the app's icons are real pictures at the sizes they claim", () => {
  it("the browser-tab icon is a 32 by 32 PNG", async () => {
    expect(contentType).toBe("image/png");
    expect(size).toEqual({ width: 32, height: 32 });
    expect(await pngSize(Icon())).toEqual({ width: 32, height: 32 });
  });

  it("the iPhone home-screen icon is a 180 by 180 PNG", async () => {
    expect(appleType).toBe("image/png");
    expect(appleSize).toEqual({ width: 180, height: 180 });
    expect(await pngSize(AppleIcon())).toEqual({ width: 180, height: 180 });
  });

  it.each(["192", "512"])("the %s px install icon is exactly that size", async (px) => {
    const res = await sized(px);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(await pngSize(res)).toEqual({ width: Number(px), height: Number(px) });
  });

  it("is prepared for exactly the sizes the install manifest points at", () => {
    expect(generateStaticParams()).toEqual([{ size: "192" }, { size: "512" }]);
  });

  it("answers anything else with Not found", async () => {
    const res = await sized("64");
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Not found");
  });
});
