/**
 * reset-password.js
 * Emergency account recovery — resets a user's password directly against
 * the live database. Run this on the server itself (it needs DATABASE_URL,
 * which is already set in the container's environment):
 *
 *   docker compose exec buildverse node scripts/reset-password.js <username> <new-password>
 *
 * For local/Electron use instead:
 *   node scripts/reset-password.js <username> <new-password>
 * (run from the project root, with DATABASE_URL pointed at the right .db —
 * see .env.example)
 */

"use strict";

const { scryptSync, randomBytes } = require("crypto");
const { PrismaClient } = require("@prisma/client");

const [username, newPassword] = process.argv.slice(2);
if (!username || !newPassword) {
  console.error("Usage: node scripts/reset-password.js <username> <new-password>");
  process.exit(1);
}
if (newPassword.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      console.error(`No user named "${username}" — check Settings → Users on the running server, or:`);
      console.error(`  docker compose exec buildverse node -e "require('@prisma/client'); (async()=>{const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();console.log(await p.user.findMany({select:{username:true,role:true}}));})()"`);
      process.exit(1);
    }
    await prisma.user.update({
      where: { username },
      data: { passwordHash: hashPassword(newPassword), mustChangePassword: false },
    });
    console.log(`Password reset for "${username}". They can sign in with the new password now.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
