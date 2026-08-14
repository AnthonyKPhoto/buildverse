import { NextRequest, NextResponse } from "next/server";
import { writeFile, rename } from "fs/promises";
import path from "path";
import { verifyPassword, isAuthEnabled } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";

// One-time migration path: seed a server deployment with an existing local
// (Electron) backup file. Photos/attachments live inline in the SQLite rows
// themselves — there's no separate blob store — so a raw .db file is a
// complete, lossless copy of everything.
//
// A single request here replaces the ENTIRE database, so the ambient session
// cookie alone isn't enough — the password must be re-entered in the request.

const SQLITE_MAGIC = "SQLite format 3\0";

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
  if (buffer.length < 16 || buffer.toString("ascii", 0, 16) !== SQLITE_MAGIC) {
    return NextResponse.json(
      { error: "That file doesn't look like a SQLite database" },
      { status: 400 }
    );
  }

  const dbPath = getDbPath();
  const tempPath = path.join(path.dirname(dbPath), `.restore-${Date.now()}.tmp`);

  try {
    await writeFile(tempPath, buffer);
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Restore failed" },
      { status: 500 }
    );
  }

  // Exit and let the container's `restart: unless-stopped` policy bring the
  // server back up against the newly-restored file — mirrors Electron's own
  // backup:restore (kill, swap the file, relaunch) rather than trying to
  // hot-swap Prisma's connection to a different file mid-process. On restart,
  // scripts/docker-init-db.js reconciles the schema (the uploaded file is
  // likely an Electron backup predating the User table) and re-creates the
  // bootstrap admin if the restored file has no users at all — otherwise a
  // restore from an old backup would lock everyone out.
  setTimeout(() => process.exit(0), 250);

  return NextResponse.json({ success: true, message: "Database restored — server restarting…" });
}
