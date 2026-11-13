import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/current-user";
import { isAuthEnabled } from "@/lib/auth/password";
import { createBackup, getBackupSettings, listBackups, pruneBackups, saveBackupSettings, backupsDir } from "@/lib/backup";

export const dynamic = "force-dynamic";

// A backup holds EVERYTHING: password hashes, the SMTP password, API keys.
// Every route here is admin-only (or, in local/desktop mode, the one local user).

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req, true);
  if (denied) return denied;
  return NextResponse.json({
    settings: await getBackupSettings(),
    backups: listBackups(),
    dir: backupsDir(),
    canRestore: isAuthEnabled(), // restoring restarts the server — only safe/possible in server mode
  });
}

const schema = z.object({
  enabled: z.boolean().optional(),
  intervalHours: z.number().min(1).max(720).optional(),
  keep: z.number().min(1).max(60).optional(),
});

export async function PUT(req: NextRequest) {
  const denied = await requireAdmin(req, true);
  if (denied) return denied;
  try {
    const settings = await saveBackupSettings(schema.parse(await req.json()));
    const removed = pruneBackups(settings.keep); // lowering "keep" takes effect immediately
    return NextResponse.json({ settings, removed });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req, true);
  if (denied) return denied;
  try {
    const backup = await createBackup();
    pruneBackups((await getBackupSettings()).keep);
    return NextResponse.json({ backup }, { status: 201 });
  } catch (err) {
    console.error("[backups] manual backup failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Backup failed — check the server log" }, { status: 500 });
  }
}
