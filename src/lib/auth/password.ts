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

const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"; // no 0/O/1/l/I — avoids transcription mistakes when a user reads this off an email
const TEMP_PASSWORD_LENGTH = 14;

/** Cryptographically random temp password for admin-created accounts that get emailed rather than typed. */
export function generateTempPassword(): string {
  const bytes = randomBytes(TEMP_PASSWORD_LENGTH);
  let out = "";
  for (let i = 0; i < TEMP_PASSWORD_LENGTH; i++) {
    out += TEMP_PASSWORD_ALPHABET[bytes[i] % TEMP_PASSWORD_ALPHABET.length];
  }
  return out;
}

// Remote auth is only active for a real server deployment (Docker), never for
// local/Electron use — AUTH_SESSION_SECRET is the switch, since it's required
// either way to sign session cookies. ADMIN_PASSWORD_HASH is now optional: if
// set, it bootstraps a specific admin account on container start (see
// scripts/docker-init-db.js); if left unset, the first person to visit the
// site gets a self-service "create the admin account" form instead (see
// /api/auth/setup) and becomes admin. Either path works, and they compose —
// docker-init-db.js only creates its bootstrap account if no admin exists yet.
export function isAuthEnabled(): boolean {
  return !!process.env.AUTH_SESSION_SECRET;
}
