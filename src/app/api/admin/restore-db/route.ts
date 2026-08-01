import { NextRequest, NextResponse } from "next/server";
import { writeFile, rename, rm, mkdir } from "fs/promises";
import path from "path";
import AdmZip from "adm-zip";
import { verifyPassword, isAuthEnabled } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";

// One-time migration path: seed the server with an existing local (Electron)
// backup. Accepts either a raw .db file (SQLite only, matches Electron's own
// "New Backup") or a .zip transfer pack (db + vehicle-files/ + tune-logs/,
// matches Electron's "Export Transfer Pack" — the format needed for
// migrating file attachments, which don't live in the SQLite file itself).
// A single request here replaces the ENTIRE server's data, so the ambient
// session cookie alone isn't enough — the password must be re-entered.

const SQLITE_MAGIC = "SQLite format 3\0";

function attachmentsRoot(): string {
  return process.env.BUILDVERSE_DATA_DIR || path.join(process.cwd(), "data");
}

// electron/main.js creates the zip via PowerShell's ZipFile.CreateFromDirectory,
// which on Windows stores entry names with backslash separators (e.g.
// "vehicle-files\veh1\photo.jpg"), not the forward slashes the ZIP spec
// conventionally uses — confirmed by actually building one and inspecting it,
// not assumed. Every entryName touched here goes through this first.
function normalizeEntryName(name: string): string {
  return name.replace(/\\/g, "/");
}

// Electron's own zip export puts buildverse.db at the archive root, but a
// re-zip through a file manager can wrap everything in one extra folder —
// detect and unwrap that the same way electron/main.js's import does.
function findZipRoot(zip: AdmZip): string {
  const names = zip.getEntries().map(e => normalizeEntryName(e.entryName));
  if (names.includes("buildverse.db")) return "";
  const topDirs = new Set(
    names
      .map(n => n.split("/")[0])
      .filter((name, i, arr) => name && arr.indexOf(name) === i)
  );
  if (topDirs.size === 1) {
    const [only] = Array.from(topDirs);
    if (names.includes(`${only}/buildverse.db`)) return `${only}/`;
  }
  return "";
}

// Prisma resolves a relative sqlite `file:` URL relative to prisma/schema.prisma's
// directory, not process.cwd() — plain fs calls need to match that convention or
// they'll silently read/write the wrong file. (Docker's DATABASE_URL is always an
// absolute path, so this only matters for relative paths used in local testing.)
function getDbPath(): string {
  const url = process.env.DATABASE_URL || "";
  const stripped = url.replace(/^file:/, "").split("?")[0];
  return path.isAbsolute(stripped) ? stripped : path.join(process.cwd(), "prisma", stripped);
}

export async function POST(req: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json(
      { error: "Not available outside a server deployment" },
      { status: 400 }
    );
  }

  // Admin-only — this replaces every user's data, not just the requester's own.
  if (req.headers.get("x-user-role") !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const userId = req.headers.get("x-user-id");

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const password = formData.get("password");
  const requester = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
  // A session's JWT only carries a userId, never re-verified against the DB
  // per-request (see src/lib/auth/session.ts) — so a session issued before a
  // *previous* restore swapped the database out from under it can still look
  // "signed in" while pointing at a user row that no longer exists. That's a
  // different problem than a wrong password, and "Incorrect password" here
  // would be actively misleading about it.
  if (userId && !requester) {
    return NextResponse.json(
      { error: "Your session doesn't match the current server data (likely from an earlier restore) — sign out and back in, then try again." },
      { status: 401 }
    );
  }
  if (
    typeof password !== "string" ||
    !requester ||
    !verifyPassword(password, requester.passwordHash)
  ) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const isZip = buffer.length >= 2 && buffer.toString("ascii", 0, 2) === "PK";

  let zip: AdmZip | null = null;
  let zipRoot = "";
  let dbBuffer: Buffer = buffer;

  if (isZip) {
    try {
      zip = new AdmZip(buffer);
      zipRoot = findZipRoot(zip);
      const dbEntry = zip.getEntries().find(e => normalizeEntryName(e.entryName) === `${zipRoot}buildverse.db`);
      if (!dbEntry) {
        return NextResponse.json(
          { error: "That zip doesn't contain a buildverse.db — is this a BuildVerse transfer pack?" },
          { status: 400 }
        );
      }
      dbBuffer = dbEntry.getData();
    } catch {
      return NextResponse.json({ error: "Couldn't read that zip file" }, { status: 400 });
    }
  }

  if (dbBuffer.length < 16 || dbBuffer.toString("ascii", 0, 16) !== SQLITE_MAGIC) {
    return NextResponse.json(
      { error: "That file doesn't look like a SQLite database" },
      { status: 400 }
    );
  }

  const dbPath = getDbPath();
  const tempPath = path.join(path.dirname(dbPath), `.restore-${Date.now()}.tmp`);

  try {
    // Attachments FIRST, database swap LAST. The db rename is the
    // point of no return (irreversible, and immediately followed by
    // process.exit() below) — if it ran first and *this* step then failed,
    // the live database would already be replaced while the response still
    // said "Restore failed", with no restart to bring docker-init-db.js's
    // schema/admin reconciliation back into play. Extracting first means a
    // failure here leaves the live database completely untouched.
    if (zip) {
      const dataDir = attachmentsRoot();
      try {
        const allEntries = zip.getEntries();
        for (const dirName of ["vehicle-files", "tune-logs"]) {
          const prefix = `${zipRoot}${dirName}/`;
          const entries = allEntries.filter(e => !e.isDirectory && normalizeEntryName(e.entryName).startsWith(prefix));
          if (entries.length === 0) continue;

          const destRoot = path.join(dataDir, dirName);
          await rm(destRoot, { recursive: true, force: true }).catch(() => {});
          await mkdir(destRoot, { recursive: true });

          for (const entry of entries) {
            const relPath = normalizeEntryName(entry.entryName).slice(prefix.length);
            const destPath = path.join(destRoot, relPath);
            // Guard against a corrupted/malicious entry (e.g. "../../etc/x")
            // writing outside destRoot — admin-only route, but cheap to check.
            if (!destPath.startsWith(destRoot + path.sep) && destPath !== destRoot) continue;
            await mkdir(path.dirname(destPath), { recursive: true });
            await writeFile(destPath, entry.getData());
          }
        }
      } catch (err) {
        // Most likely cause: BUILDVERSE_DATA_DIR isn't set (or points
        // somewhere the container's non-root user can't write), so this fell
        // back to a path inside the image's own read-only-ish layer instead
        // of the mounted volume. Surface that directly instead of a raw
        // ENOENT/EACCES fragment — see docker-compose.yml and CLAUDE.md.
        const detail = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Couldn't write attachments to "${dataDir}" (${detail}). If this is Docker, check that ` +
          `BUILDVERSE_DATA_DIR is set (docker-compose.yml) and points at the mounted volume, then ` +
          `redeploy with docker compose up -d — pulling a new image alone doesn't apply compose-file changes.`
        );
      }
    }

    await writeFile(tempPath, dbBuffer);
    // Release Prisma's handle on the live file before swapping it out — the
    // process is about to exit anyway (see below), and closing first avoids
    // renaming out from under an open connection, which is unsafe on any
    // platform even where the OS itself technically permits it.
    await prisma.$disconnect();
    // Same directory as the live file (same volume) — required for rename
    // to be atomic rather than a cross-device copy that could be interrupted
    // partway through.
    await rename(tempPath, dbPath);
  } catch (err) {
    // The rename can fail (e.g. a transient file-lock) before the temp file
    // is consumed — clean it up rather than leaving it to accumulate next
    // to the live database on every retry.
    await rm(tempPath, { force: true }).catch(() => {});
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Restore failed" },
      { status: 500 }
    );
  }

  // Exit and let the container's `restart: unless-stopped` policy bring the
  // server back up against the newly-restored file — mirrors Electron's own
  // backup/restore (kill, swap the file, relaunch) rather than trying to
  // hot-swap Prisma's connection to a different file mid-process. On restart,
  // scripts/docker-init-db.js reconciles the schema (the uploaded file may
  // predate newer tables) and re-creates the bootstrap admin if the restored
  // file has no users at all — otherwise a restore from an old backup would
  // lock everyone out.
  setTimeout(() => process.exit(0), 250);

  return NextResponse.json({
    success: true,
    message: zip ? "Database and attachments restored — server restarting…" : "Database restored — server restarting…",
  });
}
