// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageError, fileToJpeg } from "./downscale";

const jpeg = (size = 10) => new File([new Uint8Array(size)], "p.jpg", { type: "image/jpeg" });

/** A canvas that draws nothing but records what it was asked, and a decoder for a given size. */
function browserWith({ width = 4000, height = 2000, blob = true } = {}) {
  const draw = { width: 0, height: 0, filled: false };
  const bitmap = { width, height, close: vi.fn() };
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    return {
      fillRect: () => {
        draw.filled = true;
      },
      drawImage: (_b: unknown, _x: number, _y: number, w: number, h: number) => {
        draw.width = w;
        draw.height = h;
      },
      set fillStyle(_v: string) {},
    } as unknown as CanvasRenderingContext2D;
  } as never);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) =>
    cb(blob ? new Blob(["jpegbytes"], { type: "image/jpeg" }) : null),
  );
  return { draw, bitmap };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("fileToJpeg", () => {
  it("shrinks a big photo to the size limit and returns it as base64 JPEG", async () => {
    const { draw, bitmap } = browserWith({ width: 4000, height: 2000 });
    const out = await fileToJpeg(jpeg(), 1280);
    expect(out).toMatchObject({ mimeType: "image/jpeg", width: 1280, height: 640 });
    expect(draw).toMatchObject({ width: 1280, height: 640, filled: true });
    expect(atob(out.data)).toBe("jpegbytes");
    expect(bitmap.close).toHaveBeenCalled(); // memory is released
  });

  it("paints white first, so a transparent PNG does not turn black", async () => {
    const { draw } = browserWith({ width: 100, height: 100 });
    await fileToJpeg(new File(["x"], "a.png", { type: "image/png" }));
    expect(draw.filled).toBe(true);
  });

  it("refuses something that is not an image", async () => {
    browserWith();
    await expect(fileToJpeg(new File(["x"], "a.pdf", { type: "application/pdf" }))).rejects.toThrow(ImageError);
  });

  it("refuses a file over the size cap without trying to decode it", async () => {
    const { bitmap } = browserWith();
    const big = jpeg();
    Object.defineProperty(big, "size", { value: 26 * 1024 * 1024 });
    await expect(fileToJpeg(big)).rejects.toThrow("Image too large");
    expect(bitmap.close).not.toHaveBeenCalled();
  });

  it("refuses a corrupt image", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("bad")));
    await expect(fileToJpeg(jpeg())).rejects.toThrow("Could not read the image");
  });

  it("refuses, and still releases memory, when compression fails", async () => {
    const { bitmap } = browserWith({ blob: false });
    await expect(fileToJpeg(jpeg())).rejects.toThrow("Could not compress the image");
    expect(bitmap.close).toHaveBeenCalled();
  });
});
