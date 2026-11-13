import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { writeFile, mkdir, rm } from "fs/promises";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import AdmZip from "adm-zip";
import { isAuthEnabled } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { SQLITE_MAGIC, normalizeEntryName, findZipRoot, findEntry, attachmentsRoot } from "@/lib/transfer-pack";
import { cleanHttpUrl, cleanImageUrl } from "@/lib/auth/safe-url";
import { applySelfMigrations } from "@/lib/schema-migrations";

// Additive counterpart to /api/admin/restore-db — that route does a full
// destructive replace (admin-only, for your own primary migration onto a
// fresh server). This one is for bringing a *second* person's vehicles onto
// a server that already has data: it reads the zip's database into a
// scratch copy, re-creates every vehicle (and everything under it) as NEW
// records owned by the requester, and never touches anything already on the
// live server. No admin role required — any signed-in user can bring in
// their own data, same as the JSON import (Settings → Data & Backup →
// Import Data), except this also carries over vehicle-files/tune-logs,
// which the JSON export/import path doesn't include at all (those live on
// disk, not in the exported JSON).
//
// Deliberately out of scope: TrackedProduct/Receipt (global, not per-vehicle
// — carrying those over risks unique-constraint collisions with the live
// server's own tracked products for little benefit) and VehicleAccess grants
// (reference user IDs from the source install that don't exist here).

const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024; // 1 GB
const MAX_ENTRY_BYTES = 200 * 1024 * 1024;
// Same whitelist as the normal upload route — mimeType comes from the
// uploaded database, so never trust it.
const SAFE_MIME = new Set(["image/jpeg","image/png","image/gif","image/webp","image/avif","application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","text/plain"]);

export async function POST(req: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ error: "Not available outside a server deployment" }, { status: 400 });
  }
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Upload too large" }, { status: 413 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length < 2 || buffer.toString("ascii", 0, 2) !== "PK") {
    return NextResponse.json({ error: "Expected a .zip transfer pack (Settings → Data & Backup → Export Transfer Pack)" }, { status: 400 });
  }

  let zip: AdmZip;
  let zipRoot: string;
  try {
    zip = new AdmZip(buffer);
    zipRoot = findZipRoot(zip);
  } catch {
    return NextResponse.json({ error: "Couldn't read that zip file" }, { status: 400 });
  }

  const dbEntry = findEntry(zip, `${zipRoot}buildverse.db`);
  if (!dbEntry) {
    return NextResponse.json(
      { error: "That zip doesn't contain a buildverse.db — is this a BuildVerse transfer pack?" },
      { status: 400 }
    );
  }
  if (dbEntry.header.size > MAX_ENTRY_BYTES * 5) {
    return NextResponse.json({ error: "Database inside the zip is too large" }, { status: 413 });
  }
  const dbBuffer = dbEntry.getData();
  if (dbBuffer.length < 16 || dbBuffer.toString("ascii", 0, 16) !== SQLITE_MAGIC) {
    return NextResponse.json({ error: "That file doesn't look like a SQLite database" }, { status: 400 });
  }

  // Read-only scratch copy — the live database is never touched by this
  // route, only ever added to via the normal `prisma` client below.
  const tmpDbPath = path.join(os.tmpdir(), `bv-import-${randomUUID()}.db`);
  await writeFile(tmpDbPath, dbBuffer);
  const source = new PrismaClient({ datasources: { db: { url: `file:${tmpDbPath}` } } });

  let vehiclesImported = 0, modsImported = 0, filesImported = 0, tuneLogsImported = 0;

  try {
    // A transfer pack from an older app version won't have newer columns
    // (e.g. Vehicle.createdByUserId) — without this, reading it throws
    // "column does not exist" instead of importing anything.
    await applySelfMigrations(source);

    const sourceVehicles = await source.vehicle.findMany({
      include: {
        modifications: { include: { dependencies: true } },
        maintenanceLogs: true,
        budgets: true,
        dynoRuns: true,
        tuneLogs: true,
        links: true,
        vehicleNotes: true,
        files: true,
      },
    });

    for (const sv of sourceVehicles) {
      const {
        id: oldVehicleId,
        modifications, maintenanceLogs, budgets, dynoRuns, tuneLogs, links, vehicleNotes, files,
        createdByUserId: _oldCreator, createdAt: _vc, updatedAt: _vu,
        ...vehicleScalars
      } = sv;

      const newVehicle = await prisma.vehicle.create({
        data: {
          ...vehicleScalars,
          photoUrl: cleanImageUrl(vehicleScalars.photoUrl),
          instagramUrl: cleanHttpUrl(vehicleScalars.instagramUrl),
          facebookUrl: cleanHttpUrl(vehicleScalars.facebookUrl),
          createdByUserId: userId,
        },
      });
      vehiclesImported++;

      const modIdMap = new Map<string, string>();
      for (const mod of modifications) {
        const { id: oldModId, vehicleId: _mvid, dependencies: _deps, createdAt: _mc, updatedAt: _mu, ...modScalars } = mod;
        const newMod = await prisma.modification.create({
          data: {
            ...modScalars,
            link: cleanHttpUrl(modScalars.link),
            imageUrl: cleanImageUrl(modScalars.imageUrl),
            vehicleId: newVehicle.id,
          },
        });
        modIdMap.set(oldModId, newMod.id);
        modsImported++;
      }
      for (const mod of modifications) {
        for (const dep of mod.dependencies) {
          const newModId = modIdMap.get(dep.modId);
          const newDependsOnId = modIdMap.get(dep.dependsOnId);
          if (newModId && newDependsOnId) {
            await prisma.modDependency.create({ data: { modId: newModId, dependsOnId: newDependsOnId } }).catch(() => {});
          }
        }
      }

      for (const log of maintenanceLogs) {
        const { id: _id, vehicleId: _vid, createdAt: _c, updatedAt: _u, ...rest } = log;
        await prisma.maintenanceLog.create({ data: { ...rest, vehicleId: newVehicle.id } });
      }
      for (const b of budgets) {
        const { id: _id, vehicleId: _vid, createdAt: _c, updatedAt: _u, ...rest } = b;
        await prisma.budget.create({ data: { ...rest, vehicleId: newVehicle.id } }).catch(() => {});
      }
      for (const d of dynoRuns) {
        const { id: _id, vehicleId: _vid, createdAt: _c, ...rest } = d;
        await prisma.dynoRun.create({ data: { ...rest, vehicleId: newVehicle.id } });
      }
      for (const l of links) {
        const { id: _id, vehicleId: _vid, createdAt: _c, ...rest } = l;
        const safeLink = cleanHttpUrl(rest.url);
        if (!safeLink) continue;
        await prisma.vehicleLink.create({ data: { ...rest, url: safeLink, vehicleId: newVehicle.id } });
      }
      for (const n of vehicleNotes) {
        const { id: _id, vehicleId: _vid, createdAt: _c, updatedAt: _u, ...rest } = n;
        await prisma.vehicleNote.create({ data: { ...rest, vehicleId: newVehicle.id } });
      }

      // Attachments — copy the actual bytes out of the zip, not just the DB
      // rows, using freshly generated filenames so they can't collide with
      // anything already on the live server.
      for (const f of files) {
        const entry = findEntry(zip, `${zipRoot}vehicle-files/${oldVehicleId}/${f.filename}`);
        if (!entry || entry.header.size > MAX_ENTRY_BYTES || !SAFE_MIME.has(f.mimeType)) continue;
        const fExt = path.extname(f.filename).toLowerCase();
        const newFilename = `${randomUUID()}${/^\.[a-z0-9]{1,8}$/.test(fExt) ? fExt : ""}`;
        const destDir = path.join(attachmentsRoot(), "vehicle-files", newVehicle.id);
        await mkdir(destDir, { recursive: true });
        await writeFile(path.join(destDir, newFilename), entry.getData());
        await prisma.vehicleFile.create({
          data: {
            id: randomUUID(),
            vehicleId: newVehicle.id,
            filename: newFilename,
            originalName: f.originalName,
            mimeType: f.mimeType,
            size: f.size,
          },
        });
        filesImported++;
      }
      for (const t of tuneLogs) {
        const entry = findEntry(zip, `${zipRoot}tune-logs/${oldVehicleId}/${t.filename}`);
        if (!entry || entry.header.size > MAX_ENTRY_BYTES) continue;
        const tExt = path.extname(t.filename).toLowerCase();
        const newFilename = `${randomUUID()}${/^\.[a-z0-9]{1,8}$/.test(tExt) ? tExt : ".csv"}`;
        const destDir = path.join(attachmentsRoot(), "tune-logs", newVehicle.id);
        await mkdir(destDir, { recursive: true });
        await writeFile(path.join(destDir, newFilename), entry.getData());
        await prisma.tuneLog.create({
          data: {
            id: randomUUID(),
            vehicleId: newVehicle.id,
            name: t.name,
            filename: newFilename,
            originalName: t.originalName,
            size: t.size,
          },
        });
        tuneLogsImported++;
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed", vehiclesImported, modsImported },
      { status: 500 }
    );
  } finally {
    await source.$disconnect();
    await rm(tmpDbPath, { force: true }).catch(() => {});
  }

  return NextResponse.json({ success: true, vehiclesImported, modsImported, filesImported, tuneLogsImported });
}
