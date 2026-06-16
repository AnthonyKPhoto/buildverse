import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import path from "path";
import fs from "fs";

const DATA_DIR = process.env.BUILDVERSE_DATA_DIR || path.join(process.cwd(), "data");

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; logId: string } }) {
  const log = await prisma.tuneLog.findUnique({ where: { id: params.logId } });
  if (!log || log.vehicleId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(DATA_DIR, "tune-logs", params.id, log.filename);
  try { fs.unlinkSync(filePath); } catch { /* file already gone */ }

  await prisma.tuneLog.delete({ where: { id: params.logId } });
  return NextResponse.json({ ok: true });
}
