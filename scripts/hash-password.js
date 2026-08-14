/**
 * hash-password.js
 * Generates a password hash for a Docker/server deployment's .env — use it
 * for ADMIN_PASSWORD_HASH (the bootstrap admin account) and again any time
 * you want to set another user's password.
 *
 * Usage:  node scripts/hash-password.js "your-password-here"
 */

"use strict";

const { scryptSync, randomBytes } = require("crypto");

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-password.js <password>");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64);
const stored = `${salt.toString("hex")}:${hash.toString("hex")}`;

console.log("\nGenerated hash:\n");
console.log(`${stored}\n`);
console.log("For the bootstrap admin, set in your server's .env:");
console.log(`  ADMIN_PASSWORD_HASH=${stored}\n`);
