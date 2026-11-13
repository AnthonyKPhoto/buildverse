// Turns a user-picked picture into a compact, safe background.
// Client-only (canvas). The result is a JPEG data URL — re-encoding through a canvas means:
//   • the original file is never stored or sent anywhere,
//   • metadata (EXIF, GPS location, camera info) is dropped,
//   • only pixels survive, so nothing in the file can execute or reference anything.

const ACCEPT = /^image\/(png|jpe?g|webp|avif)$/i;
const MAX_INPUT_BYTES = 30 * 1024 * 1024;
const MAX_SIDE = 2560;            // plenty for a desktop background; keeps storage small
const MAX_OUTPUT_BYTES = 2.4 * 1024 * 1024; // browsers allow ~5 MB of localStorage in total

export interface ProcessedBackground {
  dataUrl: string;
  width: number;
  height: number;
  /** Average perceived brightness, 0 (black) … 1 (white). */
  luminance: number;
}

async function decode(file: File): Promise<{ draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file); // applies EXIF orientation
      return { width: bmp.width, height: bmp.height, draw: (c, w, h) => c.drawImage(bmp, 0, 0, w, h) };
    } catch { /* fall through to <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("That file couldn't be read as an image"));
      i.src = url;
    });
    return { width: img.naturalWidth, height: img.naturalHeight, draw: (c, w, h) => c.drawImage(img, 0, 0, w, h) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function processBackgroundFile(file: File): Promise<ProcessedBackground> {
  if (!ACCEPT.test(file.type)) throw new Error("Please choose a PNG, JPEG, WebP or AVIF picture");
  if (file.size > MAX_INPUT_BYTES) throw new Error("That picture is over 30 MB — pick a smaller one");

  const src = await decode(file);
  if (!src.width || !src.height) throw new Error("That file couldn't be read as an image");

  let scale = Math.min(1, MAX_SIDE / Math.max(src.width, src.height));
  let quality = 0.86;
  let dataUrl = "";
  let w = 0, h = 0;

  // Re-encode, stepping quality and then size down until it fits comfortably in storage.
  for (let attempt = 0; attempt < 8; attempt++) {
    w = Math.max(1, Math.round(src.width * scale));
    h = Math.max(1, Math.round(src.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser can't process images");
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h); // transparent PNGs flatten onto black, not garbage
    src.draw(ctx, w, h);
    dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length * 0.75 <= MAX_OUTPUT_BYTES) break;
    if (quality > 0.6) quality -= 0.12; else scale *= 0.8;
  }
  if (dataUrl.length * 0.75 > MAX_OUTPUT_BYTES) throw new Error("Couldn't shrink that picture enough — try a smaller one");

  // Brightness from a tiny copy (cheap, and good enough to pick a default tint)
  const probe = document.createElement("canvas");
  probe.width = 32; probe.height = 32;
  const pctx = probe.getContext("2d")!;
  src.draw(pctx, 32, 32);
  const px = pctx.getImageData(0, 0, 32, 32).data;
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) sum += (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
  const luminance = sum / (px.length / 4);

  return { dataUrl, width: w, height: h, luminance };
}

/**
 * A starting tint so text stays readable on whatever picture was chosen: bright pictures get a
 * stronger dark veil on dark themes; dark pictures get a stronger white veil on the light theme.
 */
export function suggestTint(luminance: number, lightTheme: boolean): number {
  const clash = lightTheme ? 1 - luminance : luminance; // how much the picture fights the theme's text
  return Math.round(Math.min(65, Math.max(18, 18 + clash * 60)));
}
