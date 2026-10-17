/**
 * Shrinks a phone photo before it is sent anywhere. Budget phones take 12 to 50 MP
 * photos (5 to 15 MB); sending them raw wastes mobile data and can break the request
 * size limit. A 1280px JPEG is plenty for a model to read an earnings screen or a notice.
 *
 * Browser only (uses canvas). fitWithin() is pure so it can be unit-tested.
 */

export interface ScaledImage {
  mimeType: "image/jpeg";
  /** base64, no data: prefix */
  data: string;
  width: number;
  height: number;
}

export class ImageError extends Error {}

const MAX_INPUT_BYTES = 25 * 1024 * 1024;

/** Largest size that fits inside maxSide on its longest edge, never upscaling. */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };
  const scale = maxSide / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function fileToJpeg(file: File, maxSide = 1280, quality = 0.8): Promise<ScaledImage> {
  if (!file.type.startsWith("image/")) throw new ImageError("Not an image");
  if (file.size > MAX_INPUT_BYTES) throw new ImageError("Image too large");

  let bitmap: ImageBitmap;
  try {
    // imageOrientation applies the EXIF rotation, so sideways phone photos are upright.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageError("Could not read the image");
  }

  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageError("Canvas unavailable");
    // White behind transparent PNGs, otherwise they turn black as JPEG.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new ImageError("Could not compress the image");
    return { mimeType: "image/jpeg", data: await blobToBase64(blob), width, height };
  } finally {
    bitmap.close();
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new ImageError("Could not read the image"));
    reader.onload = () => {
      const url = String(reader.result);
      resolve(url.slice(url.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}
