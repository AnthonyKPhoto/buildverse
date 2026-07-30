import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// BV_DATABASE_URL is set by Electron main.js as an absolute path and takes
// priority over the relative DATABASE_URL baked into the standalone .env file.
let datasourceUrl = process.env.BV_DATABASE_URL || process.env.DATABASE_URL;

// Serialize Prisma's internal connection pool to 1 for SQLite. Combined with
// WAL mode (enabled once at startup by scripts/docker-init-db.js), this avoids
// SQLITE_BUSY errors when two clients — e.g. the PC app and a phone, both
// talking to the same server — write at close to the same moment.
if (datasourceUrl?.startsWith("file:") && !datasourceUrl.includes("connection_limit=")) {
  datasourceUrl += (datasourceUrl.includes("?") ? "&" : "?") + "connection_limit=1";
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: datasourceUrl ? { db: { url: datasourceUrl } } : undefined,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Schema migrations for existing databases (idempotent — errors from already-existing
// columns/tables are silently swallowed). Run once on startup.
;(async () => {
  const stmts = [
    // Vehicle.notes — added for build journal
    `ALTER TABLE "Vehicle" ADD COLUMN "notes" TEXT`,
    // Modification columns that may be absent in pre-v1.1 databases
    `ALTER TABLE "Modification" ADD COLUMN "orderNumber" TEXT`,
    `ALTER TABLE "Modification" ADD COLUMN "partNumber" TEXT`,
    `ALTER TABLE "Modification" ADD COLUMN "actualPrice" REAL`,
    `ALTER TABLE "Modification" ADD COLUMN "laborCost" REAL`,
    `ALTER TABLE "Modification" ADD COLUMN "diyInstall" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE "Modification" ADD COLUMN "installMileage" INTEGER`,
    // ModDependency table — may not exist in older databases
    `CREATE TABLE IF NOT EXISTS "ModDependency" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "modId" TEXT NOT NULL,
      "dependsOnId" TEXT NOT NULL,
      FOREIGN KEY ("modId") REFERENCES "Modification"("id") ON DELETE CASCADE,
      FOREIGN KEY ("dependsOnId") REFERENCES "Modification"("id") ON DELETE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "ModDependency_modId_dependsOnId_key"
     ON "ModDependency"("modId","dependsOnId")`,
    // Budget table — may not exist in older databases
    `CREATE TABLE IF NOT EXISTS "Budget" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "vehicleId" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "planned" REAL NOT NULL DEFAULT 0,
      "actual" REAL NOT NULL DEFAULT 0,
      "notes" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Budget_vehicleId_category_key"
     ON "Budget"("vehicleId","category")`,
    // VehicleFile table — added in v1.2.4
    `CREATE TABLE IF NOT EXISTS "VehicleFile" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "vehicleId" TEXT NOT NULL,
      "filename" TEXT NOT NULL,
      "originalName" TEXT NOT NULL,
      "mimeType" TEXT NOT NULL,
      "size" INTEGER NOT NULL,
      "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "VehicleFile_vehicleId_idx" ON "VehicleFile"("vehicleId")`,
    // DynoRun table — added in v1.2.6
    `CREATE TABLE IF NOT EXISTS "DynoRun" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "vehicleId" TEXT NOT NULL,
      "date" DATETIME NOT NULL,
      "hp" REAL,
      "torque" REAL,
      "label" TEXT,
      "notes" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "DynoRun_vehicleId_idx" ON "DynoRun"("vehicleId")`,
    // TrackedProduct.alertThreshold — added in v1.2.6
    `ALTER TABLE "TrackedProduct" ADD COLUMN "alertThreshold" REAL`,
    // TuneLog table — added in v1.2.8
    `CREATE TABLE IF NOT EXISTS "TuneLog" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "vehicleId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "filename" TEXT NOT NULL,
      "originalName" TEXT NOT NULL,
      "size" INTEGER NOT NULL,
      "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "TuneLog_vehicleId_idx" ON "TuneLog"("vehicleId")`,
    // Setting table — added in v1.3.0 for custom categories and other KV settings
    `CREATE TABLE IF NOT EXISTS "Setting" (
      "key" TEXT NOT NULL PRIMARY KEY,
      "value" TEXT NOT NULL,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    // Vehicle social links — added in v1.3.2
    `ALTER TABLE "Vehicle" ADD COLUMN "instagramUrl" TEXT`,
    `ALTER TABLE "Vehicle" ADD COLUMN "facebookUrl" TEXT`,
    // VehicleLink table — added in v1.3.2 for reference links tab
    `CREATE TABLE IF NOT EXISTS "VehicleLink" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "vehicleId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "url" TEXT NOT NULL,
      "description" TEXT,
      "category" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "VehicleLink_vehicleId_idx" ON "VehicleLink"("vehicleId")`,
    // MaintenanceLog.externalId — added in v1.3.1 for LubeLogger sync deduplication
    `ALTER TABLE "MaintenanceLog" ADD COLUMN "externalId" TEXT`,
    `CREATE INDEX IF NOT EXISTS "MaintenanceLog_externalId_idx" ON "MaintenanceLog"("externalId")`,
    // VehicleNote table — added in v1.3.24 for sticky note board
    `CREATE TABLE IF NOT EXISTS "VehicleNote" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "vehicleId" TEXT NOT NULL,
      "title" TEXT NOT NULL DEFAULT '',
      "content" TEXT NOT NULL DEFAULT '',
      "color" TEXT NOT NULL DEFAULT 'yellow',
      "importance" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "VehicleNote_vehicleId_idx" ON "VehicleNote"("vehicleId")`,
    // VehicleNote.importance — added in v1.3.25 (column may be absent if table was created by v1.3.24)
    `ALTER TABLE "VehicleNote" ADD COLUMN "importance" INTEGER NOT NULL DEFAULT 0`,
    // User table — added for multi-user server logins. Inert for local/Electron
    // use (nothing reads it unless ADMIN_PASSWORD_HASH is set), but created here
    // too so an in-place Electron update never leaves it missing.
    `CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "username" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'member',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username")`,
    // User columns for admin-managed accounts (temp-password email + forced
    // change) and per-user appearance — added after the initial User table.
    `ALTER TABLE "User" ADD COLUMN "email" TEXT`,
    `ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT 0`,
    `ALTER TABLE "User" ADD COLUMN "accentColor" TEXT`,
    `ALTER TABLE "User" ADD COLUMN "radius" TEXT`,
    `ALTER TABLE "User" ADD COLUMN "font" TEXT`,
    `ALTER TABLE "User" ADD COLUMN "colorScheme" TEXT`,
    // Vehicle.createdByUserId + VehicleAccess — per-vehicle edit permissions.
    `ALTER TABLE "Vehicle" ADD COLUMN "createdByUserId" TEXT`,
    `CREATE INDEX IF NOT EXISTS "Vehicle_createdByUserId_idx" ON "Vehicle"("createdByUserId")`,
    `CREATE TABLE IF NOT EXISTS "VehicleAccess" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "vehicleId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "VehicleAccess_vehicleId_userId_key" ON "VehicleAccess"("vehicleId","userId")`,
  ];
  for (const sql of stmts) {
    await prisma.$executeRawUnsafe(sql).catch(() => {});
  }
  // Migrate legacy MEDIUM priority → NONE (one-time, idempotent)
  await prisma.$executeRaw`UPDATE "Modification" SET "priority" = 'NONE' WHERE "priority" = 'MEDIUM'`.catch(() => {});
})();
