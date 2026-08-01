import AdmZip from "adm-zip";
import path from "path";

// Shared by src/app/api/admin/restore-db (destructive full replace) and
// src/app/api/import-zip (additive merge) — both consume the same .zip
// transfer pack format produced by electron/main.js's transfer:export-zip.

export const SQLITE_MAGIC = "SQLite format 3\0";

// electron/main.js creates the zip via PowerShell's ZipFile.CreateFromDirectory,
// which on Windows stores entry names with backslash separators (e.g.
// "vehicle-files\veh1\photo.jpg"), not the forward slashes the ZIP spec
// conventionally uses — confirmed by actually building one and inspecting it,
// not assumed. Every entryName touched anywhere in either route goes through
// this first.
export function normalizeEntryName(name: string): string {
  return name.replace(/\\/g, "/");
}

// Electron's own zip export puts buildverse.db at the archive root, but a
// re-zip through a file manager can wrap everything in one extra folder —
// detect and unwrap that the same way electron/main.js's import does.
export function findZipRoot(zip: AdmZip): string {
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

export function findEntry(zip: AdmZip, normalizedName: string) {
  return zip.getEntries().find(e => normalizeEntryName(e.entryName) === normalizedName);
}

// Where vehicle-files/ and tune-logs/ live on disk — see also
// src/app/api/vehicles/[id]/files/route.ts and .../tune-logs/route.ts, which
// this must match exactly.
export function attachmentsRoot(): string {
  return process.env.BUILDVERSE_DATA_DIR || path.join(process.cwd(), "data");
}
