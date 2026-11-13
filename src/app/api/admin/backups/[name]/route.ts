import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/current-user";
import { backupPath } from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { name: string } }) {
  const denied = await requireAdmin(req, true);
  if (denied) return denied;
  const file = backupPath(params.name);
  if (!file || !fs.existsSync(file)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const buf = fs.readFileSync(file);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${params.name}"`,
      "Content-Length": String(buf.length),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { name: string } }) {
  const denied = await requireAdmin(req, true);
  if (denied) return denied;
  const file = backupPath(params.name);
  if (!file || !fs.existsSync(file)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  fs.unlinkSync(file);
  return NextResponse.json({ success: true });
}
