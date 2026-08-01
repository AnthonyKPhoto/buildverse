import { PrismaClient } from "@prisma/client";
import { applySelfMigrations } from "@/lib/schema-migrations";

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

// Schema migrations for the live database — see src/lib/schema-migrations.ts
// (also reused by /api/import-zip against an *uploaded* database). Run once
// on startup.
applySelfMigrations(prisma);
