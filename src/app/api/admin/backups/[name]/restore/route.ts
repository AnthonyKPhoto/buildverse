import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getVerifiedUser } from "@/lib/auth/current-user";
import { isAuthEnabled, verifyPassword } from "@/lib/auth/password";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import { backupPath, restoreBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

// Same bar as /api/admin/restore-db: server mode, a current admin, AND the
// admin's own password again — this replaces every user's data.
const limiter = createRateLimiter(5, 15 * 60 * 1000);

export async function POST(req: NextRequest, { params }: { params: { name: string } }) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ error: "Restoring from here is only available on a server deployment" }, { status: 400 });
  }
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const me = await getVerifiedUser(req);
  if (limiter.isLimited(me!.id)) return NextResponse.json({ error: "Too many attempts — try again later" }, { status: 429 });

  let password: string;
  try { ({ password } = z.object({ password: z.string().min(1) }).parse(await req.json())); }
  catch { return NextResponse.json({ error: "Password required" }, { status: 400 }); }

  const user = await prisma.user.findUnique({ where: { id: me!.id } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    limiter.record(me!.id);
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }
  if (!backupPath(params.name)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const { safety } = await restoreBackup(params.name);
    return NextResponse.json({ success: true, safetyBackup: safety.name, message: "Restored — server restarting…" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Restore failed" }, { status: 500 });
  }
}
