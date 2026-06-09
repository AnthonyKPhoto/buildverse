/**
 * prepare-template-db.js
 * Run as part of the build process to ensure prisma/dev.db (the template
 * bundled inside the installer) has the correct schema applied and is empty
 * of user data.
 *
 * Usage:  node scripts/prepare-template-db.js
 */

"use strict";

const { execSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const devDbUrl = "file:" + path.join(root, "prisma", "dev.db").replace(/\\/g, "/");

console.log("[prepare-template-db] Pushing schema to dev.db template…");
console.log("[prepare-template-db] URL:", devDbUrl);

// Push schema to the template DB (creates tables if missing, no-ops if already correct)
execSync(`npx prisma db push --skip-generate --accept-data-loss`, {
  cwd: root,
  env: { ...process.env, DATABASE_URL: devDbUrl },
  stdio: "inherit",
});

// Now clear any data that might have crept in (wipe rows but keep schema)
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({
  datasources: { db: { url: devDbUrl } },
});

async function wipe() {
  await prisma.modDependency.deleteMany({});
  await prisma.modification.deleteMany({});
  await prisma.maintenanceLog.deleteMany({});
  await prisma.budget.deleteMany({});
  await prisma.vehicle.deleteMany({});
  await prisma.priceHistory.deleteMany({});
  await prisma.trackedProduct.deleteMany({});
  const count = await prisma.vehicle.count();
  console.log(`[prepare-template-db] ✓ Template DB ready. Vehicles: ${count}`);
  await prisma.$disconnect();
}

wipe().catch((err) => {
  console.error("[prepare-template-db] Error:", err.message);
  process.exit(1);
});
