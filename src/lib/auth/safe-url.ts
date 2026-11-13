import { z } from "zod";

// Only http(s) — `z.string().url()` happily accepts javascript: and data:
// URLs, which become stored XSS the moment they're rendered as an <a href>.
export function isHttpUrl(u: unknown): u is string {
  return typeof u === "string" && /^https?:\/\//i.test(u.trim());
}

export const httpUrl = z.string().max(2000).refine(isHttpUrl, "Only http/https URLs are allowed");

/** Same as isHttpUrl but also allows base64 images (vehicle/mod photos). */
export function isHttpOrImageDataUrl(u: unknown): u is string {
  return typeof u === "string" && (isHttpUrl(u) || /^data:image\/(png|jpe?g|gif|webp|avif);base64,/i.test(u));
}

/** For data coming from an untrusted source (e.g. an imported database). */
export function cleanHttpUrl(u: unknown): string | null {
  return isHttpUrl(u) ? u.trim() : null;
}
export function cleanImageUrl(u: unknown): string | null {
  return isHttpOrImageDataUrl(u) ? u : null;
}
