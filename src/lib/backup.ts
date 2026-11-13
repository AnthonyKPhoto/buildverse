import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { attachmentsRoot, SQLITE_MAGIC } from "@/lib/transfer-pack";

// Scheduled + manual database backups. Snapshots use SQLite's `VACUUM INTO`,
// which writes a consistent, compact copy even while the app is running in WAL
// mode (a plain file copy can miss recent writes that are still in the -wal file).
//
// Stored in <data dir>/backups — on the mounted volume in Docker, and in the
// same folder the desktop app's own backup list reads — using the same
// `buildverse-<timestamp>.db` naming, so both see each other's files.

const SETTINGS_KEY = "auto_backups";

export interface BackupSettings {
  enabled: boolean;
  /** Take a new backup when the newest one is older than this many hours. */
  intervalHours: number;
  /** Keep this many of the newest backups; older ones are deleted. */
  keep: number;
}

export const DEFAULT_BACKUP_SETTINGS: BackupSettings = { enabled: true, intervalHours: 24, keep: 7 };

export function sanitizeBackupSettings(input: Partial<BackupSettings>, base: BackupSettings): BackupSettings {
  const next = { ...base };
  if (typeof input.enabled === "boolean") next.enabled = input.enabled;
  if (typeof input.intervalHours === "number" && Number.isFinite(input.intervalHours)) {
    next.intervalHours = Math.min(24 * 30, Math.max(1, Math.round(input.intervalHours)));
  }
  if (typeof input.keep === "number" && Number.isFinite(input.keep)) {
    next.keep = Math.min(60, Math.max(1, Math.round(input.keep)));
  }
  return next;
}

export async function getBackupSettings(): Promise<BackupSettings> {
  const row = await prisma.setting.findUnique({ where: { key: SETTINGS_KEY } }).catch(() => null);
  if (!row) return { ...DEFAULT_BACKUP_SETTINGS };
  try { return sanitizeBackupSettings(JSON.parse(row.value), DEFAULT_BACKUP_SETTINGS); }
  catch { return { ...DEFAULT_BACKUP_SETTINGS }; }
}

export async function saveBackupSettings(input: Partial<BackupSettings>): Promise<BackupSettings> {
  const next = sanitizeBackupSettings(input, await getBackupSettings());
  const value = JSON.stringify(next);
  await prisma.setting.upsert({ where: { key: SETTINGS_KEY }, update: { value }, create: { key: SETTINGS_KEY, value } });
  return next;
}

export function backupsDir(): string {
  return path.join(attachmentsRoot(), "backups");
}

// Strict allow-list: the name comes from a URL, so it must never be able to
// point outside the backups folder (no slashes, no "..").
const NAME_RE = /^buildverse-[0-9A-Za-z._-]{1,80}\.db$/;
export function isValidBackupName(name: string): boolean {
  return NAME_RE.test(name) && !name.includes("..");
}

export function backupPath(name: string): string | null {
  if (!isValidBackupName(name)) return null;
  const full = path.resolve(backupsDir(), name);
  return full.startsWith(path.resolve(backupsDir()) + path.sep) ? full : null;
}

export interface BackupInfo { name: string; size: number; createdAt: string }

export function listBackups(): BackupInfo[] {
  const dir = backupsDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(isValidBackupName)
    .map((name) => {
      const st = fs.statSync(path.join(dir, name));
      return { name, size: st.size, createdAt: st.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export async function createBackup(label?: string): Promise<BackupInfo> {
  const dir = backupsDir();
  fs.mkdirSync(dir, { recursive: true });
  const safeLabel = label ? `${label.replace(/[^A-Za-z0-9-]/g, "")}-` : "";
  let name = `buildverse-${safeLabel}${stamp()}.db`;
  let dest = path.join(dir, name);
  for (let i = 2; fs.existsSync(dest); i++) { // two backups in the same second
    name = `buildverse-${safeLabel}${stamp()}-${i}.db`;
    dest = path.join(dir, name);
  }
  // dest is built from our own constants above, but escape quotes anyway
  await prisma.$executeRawUnsafe(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  const st = fs.statSync(dest);
  return { name, size: st.size, createdAt: st.mtime.toISOString() };
}

/** Deletes everything but the newest `keep` backups. Returns how many were removed. */
export function pruneBackups(keep: number): number {
  const old = listBackups().slice(keep);
  let removed = 0;
  for (const b of old) {
    try { fs.unlinkSync(path.join(backupsDir(), b.name)); removed++; } catch { /* in use / already gone */ }
  }
  return removed;
}

/** Called by the scheduler: back up if enabled and the newest backup is older than the interval. */
export async function runScheduledBackup(): Promise<BackupInfo | null> {
  const settings = await getBackupSettings();
  if (!settings.enabled) return null;
  const newest = listBackups()[0];
  if (newest && Date.now() - new Date(newest.createdAt).getTime() < settings.intervalHours * 3_600_000) return null;
  const made = await createBackup();
  pruneBackups(settings.keep);
  return made;
}

// ── Restore (server mode only — see the route) ───────────────────────────────

function liveDbPath(): string {
  const url = process.env.DATABASE_URL || "";
  const stripped = url.replace(/^file:/, "").split("?")[0];
  return path.isAbsolute(stripped) ? stripped : path.join(process.cwd(), "prisma", stripped);
}

/**
 * Replaces the live database with a backup, then exits so the container's
 * restart policy brings the server back up on the restored file (same approach
 * as /api/admin/restore-db). A safety backup of the current data is taken first.
 */
export async function restoreBackup(name: string): Promise<{ safety: BackupInfo }> {
  const src = backupPath(name);
  if (!src || !fs.existsSync(src)) throw new Error("Backup not found");

  const head = Buffer.alloc(16);
  const fd = fs.openSync(src, "r");
  try { fs.readSync(fd, head, 0, 16, 0); } finally { fs.closeSync(fd); }
  if (head.toString("ascii") !== SQLITE_MAGIC) throw new Error("That file isn't a valid SQLite database");

  const safety = await createBackup("before-restore");

  const dbPath = liveDbPath();
  const tmp = path.join(path.dirname(dbPath), `.restore-${Date.now()}.tmp`);
  fs.copyFileSync(src, tmp);
  await prisma.$disconnect();
  fs.renameSync(tmp, dbPath);
  // A leftover -wal/-shm from the OLD database would be replayed onto the restored file
  for (const ext of ["-wal", "-shm"]) fs.rmSync(`${dbPath}${ext}`, { force: true });

  setTimeout(() => process.exit(0), 250);
  return { safety };
}
