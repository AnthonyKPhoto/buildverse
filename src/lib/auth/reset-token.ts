import { randomBytes, createHash } from "crypto";

// The raw token goes in the emailed link and is never stored — only its
// SHA-256 hash is (see PasswordResetToken.tokenHash), so a database read
// alone can't be replayed as a valid reset link. This is a high-entropy
// random value, not a low-entropy password, so a fast hash (not scrypt) is
// fine here and keeps token lookups cheap.
export function generateResetToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  return { raw, hash: hashResetToken(raw) };
}

export function hashResetToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export const RESET_TOKEN_LIFETIME_MS = 30 * 60 * 1000; // 30 minutes
