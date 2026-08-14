import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

// Node-only (scrypt isn't available in the Edge runtime) — only ever import
// this from the login route or the hash-password CLI script, never from
// src/middleware.ts.

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [saltHex, hashHex] = storedHash.split(":");
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, expected.length);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Server auth is only active when the bootstrap admin has been configured (Docker deployment). */
export function isAuthEnabled(): boolean {
  return !!process.env.ADMIN_PASSWORD_HASH;
}
