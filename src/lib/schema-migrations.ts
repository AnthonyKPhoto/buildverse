import type { PrismaClient } from "@prisma/client";

// Fetch the column names that currently exist in a SQLite table.
// Returns an empty Set if the table doesn't exist yet (safe to call speculatively).
async function existingColumns(client: PrismaClient, table: string): Promise<Set<string>> {
  const rows = await client
    .$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("${table}")`)
    .catch(() => [] as { name: string }[]);
  return new Set(rows.map((r) => r.name));
}

// Run an ALTER TABLE ADD COLUMN only when the column is confirmed absent.
// Never throws — logs on unexpected failure so errors stay visible.
async function addColumn(
  client: PrismaClient,
  cols: Set<string>,
  column: string,
  definition: string,
  table: string
): Promise<void> {
  if (cols.has(column)) return;
  await client
    .$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`)
    .catch((err: Error) =>
      console.error(`[migrations] Failed to add ${table}.${column}:`, err.message)
    );
}

// Idempotent schema reconciliation for the live application database.
//
// Two callers:
//  - src/lib/prisma.ts  → runs against the live DB on every app startup, which
//    is the only migration path for in-place Electron updates (Electron never
//    runs `prisma db push` against the user's existing database).
//  - /api/import-zip    → runs against the extracted transfer-pack database
//    before reading from it, so an older export never triggers "column does
//    not exist" errors.
//
// Rules:
//  • CREATE TABLE/INDEX IF NOT EXISTS — already idempotent; no pre-check needed.
//  • ALTER TABLE ADD COLUMN           — checked via PRAGMA table_info first so
//    we never attempt an ADD COLUMN that would fail on an already-present column.
//  • UPDATE / upsert backfills        — guarded by a Setting flag or a WHERE
//    clause so they only touch rows that need it.
export async function applySelfMigrations(client: PrismaClient): Promise<void> {
  // ── Idempotent table / index creation ──────────────────────────────────────
  const ddl = [
    // ModDependency — may not exist in pre-v1.1 databases
    `CREATE TABLE IF NOT EXISTS "ModDependency" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "modId" TEXT NOT NULL,
      "dependsOnId" TEXT NOT NULL,
      FOREIGN KEY ("modId") REFERENCES "Modification"("id") ON DELETE CASCADE,
      FOREIGN KEY ("dependsOnId") REFERENCES "Modification"("id") ON DELETE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "ModDependency_modId_dependsOnId_key"
     ON "ModDependency"("modId","dependsOnId")`,
    // Budget — may not exist in pre-v1.2 databases
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
    // VehicleFile — added in v1.2.4
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
    // DynoRun — added in v1.2.6
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
    // TuneLog — added in v1.2.8
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
    // Setting — added in v1.3.0 for custom categories / KV settings
    `CREATE TABLE IF NOT EXISTS "Setting" (
      "key" TEXT NOT NULL PRIMARY KEY,
      "value" TEXT NOT NULL,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    // VehicleLink — added in v1.3.2
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
    // MaintenanceLog.externalId index — column added below, index here
    `CREATE INDEX IF NOT EXISTS "MaintenanceLog_externalId_idx" ON "MaintenanceLog"("externalId")`,
    // VehicleNote — added in v1.3.24 (sticky-note board, reworked into build log in v1.11.0)
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
    // User — server logins; inert for local/Electron use
    `CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "username" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'member',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username")`,
    // Vehicle.createdByUserId index (column added below)
    `CREATE INDEX IF NOT EXISTS "Vehicle_createdByUserId_idx" ON "Vehicle"("createdByUserId")`,
    // VehicleAccess — per-vehicle edit permissions
    `CREATE TABLE IF NOT EXISTS "VehicleAccess" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "vehicleId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "VehicleAccess_vehicleId_userId_key"
     ON "VehicleAccess"("vehicleId","userId")`,
    // PasswordResetToken — self-service forgot-password flow
    `CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "tokenHash" TEXT NOT NULL,
      "expiresAt" DATETIME NOT NULL,
      "usedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key"
     ON "PasswordResetToken"("tokenHash")`,
    `CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx"
     ON "PasswordResetToken"("userId")`,
  ];
  for (const sql of ddl) {
    await client.$executeRawUnsafe(sql).catch(() => {});
  }

  // ── Column additions (pre-checked against PRAGMA table_info) ───────────────
  // We fetch existing columns once per table and skip any that are already present,
  // so no ALTER TABLE ever runs against a column that already exists.

  const vehicleCols = await existingColumns(client, "Vehicle");
  await addColumn(client, vehicleCols, "notes",            "TEXT",    "Vehicle");
  await addColumn(client, vehicleCols, "instagramUrl",     "TEXT",    "Vehicle");
  await addColumn(client, vehicleCols, "facebookUrl",      "TEXT",    "Vehicle");
  await addColumn(client, vehicleCols, "createdByUserId",  "TEXT",    "Vehicle");

  const modCols = await existingColumns(client, "Modification");
  await addColumn(client, modCols, "orderNumber",   "TEXT",                    "Modification");
  await addColumn(client, modCols, "partNumber",    "TEXT",                    "Modification");
  await addColumn(client, modCols, "actualPrice",   "REAL",                    "Modification");
  await addColumn(client, modCols, "laborCost",     "REAL",                    "Modification");
  await addColumn(client, modCols, "diyInstall",    "INTEGER NOT NULL DEFAULT 0", "Modification");
  await addColumn(client, modCols, "installMileage","INTEGER",                 "Modification");

  const trackedProductCols = await existingColumns(client, "TrackedProduct");
  await addColumn(client, trackedProductCols, "alertThreshold", "REAL", "TrackedProduct");

  const maintenanceCols = await existingColumns(client, "MaintenanceLog");
  await addColumn(client, maintenanceCols, "externalId", "TEXT", "MaintenanceLog");

  const noteCols = await existingColumns(client, "VehicleNote");
  await addColumn(client, noteCols, "importance", "INTEGER NOT NULL DEFAULT 0",  "VehicleNote");
  // v1.11.0 — build log rework (color/importance kept for data safety, no longer shown in UI)
  await addColumn(client, noteCols, "entryDate",  "DATETIME",                    "VehicleNote");
  await addColumn(client, noteCols, "mileage",    "INTEGER",                     "VehicleNote");
  await addColumn(client, noteCols, "pinned",     "BOOLEAN NOT NULL DEFAULT 0",  "VehicleNote");

  const userCols = await existingColumns(client, "User");
  await addColumn(client, userCols, "email",              "TEXT",                     "User");
  await addColumn(client, userCols, "mustChangePassword", "BOOLEAN NOT NULL DEFAULT 0","User");
  await addColumn(client, userCols, "accentColor",        "TEXT",                     "User");
  await addColumn(client, userCols, "radius",             "TEXT",                     "User");
  await addColumn(client, userCols, "font",               "TEXT",                     "User");
  await addColumn(client, userCols, "colorScheme",        "TEXT",                     "User");

  // ── Data backfills ──────────────────────────────────────────────────────────

  // Migrate legacy MEDIUM priority → NONE (one-time, the WHERE guard is idempotent)
  await client.$executeRaw`UPDATE "Modification" SET "priority" = 'NONE' WHERE "priority" = 'MEDIUM'`.catch(() => {});

  // Backfill entryDate for notes that predate the column — only touches NULL rows
  await client.$executeRaw`UPDATE "VehicleNote" SET "entryDate" = "createdAt" WHERE "entryDate" IS NULL`.catch(() => {});

  // One-time backfill: starred notes under the old sticky-note UI become pinned
  // entries in the new build-log timeline. Guarded by a Setting flag so it only
  // runs once — re-running would re-pin notes someone deliberately unpinned.
  const PIN_BACKFILL_KEY = "vehicleNotePinBackfillDone";
  const pinBackfillDone = await client.setting
    .findUnique({ where: { key: PIN_BACKFILL_KEY } })
    .catch(() => null);
  if (!pinBackfillDone) {
    await client.$executeRaw`UPDATE "VehicleNote" SET "pinned" = 1 WHERE "importance" > 0`.catch(() => {});
    await client.setting
      .upsert({
        where:  { key: PIN_BACKFILL_KEY },
        update: { value: "true" },
        create: { key: PIN_BACKFILL_KEY, value: "true" },
      })
      .catch(() => {});
  }
}
