// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageError, fileToJpeg } from "./downscale";

const photo = () => new File([new Uint8Array(10)], "p.jpg", { type: "image/jpeg" });

function decodablePhone(context: unknown) {
  const bitmap = { width: 100, height: 100, close: vi.fn() };
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as never);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) =>
    cb(new Blob(["x"], { type: "image/jpeg" })),
  );
  return bitmap;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("fileToJpeg: when the phone cannot finish the job", () => {
  it("refuses cleanly when the browser cannot draw, and still frees the photo from memory", async () => {
    const bitmap = decodablePhone(null);
    await expect(fileToJpeg(photo())).rejects.toThrow(new ImageError("Canvas unavailable"));
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it("refuses cleanly when the compressed picture cannot be read back", async () => {
    const bitmap = decodablePhone({ fillRect() {}, drawImage() {}, set fillStyle(_v: string) {} });
    vi.stubGlobal(
      "FileReader",
      class {
        onerror: (() => void) | null = null;
        onload: (() => void) | null = null;
        readAsDataURL() {
          setTimeout(() => this.onerror?.(), 0);
        }
      },
    );
    await expect(fileToJpeg(photo())).rejects.toThrow("Could not read the image");
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it("keeps a small photo at its own size instead of enlarging it", async () => {
    const draws: number[][] = [];
    decodablePhone({
      fillRect() {},
      drawImage: (_b: unknown, _x: number, _y: number, w: number, h: number) => draws.push([w, h]),
      set fillStyle(_v: string) {},
    });
    const out = await fileToJpeg(photo(), 1280);
    expect(draws).toEqual([[100, 100]]);
    expect(out).toMatchObject({ width: 100, height: 100 });
  });
});
