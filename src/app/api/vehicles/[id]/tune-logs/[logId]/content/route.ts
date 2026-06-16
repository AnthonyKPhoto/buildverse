import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import path from "path";
import fs from "fs";

const DATA_DIR = process.env.BUILDVERSE_DATA_DIR || path.join(process.cwd(), "data");

export async function GET(_req: NextRequest, { params }: { params: { id: string; logId: string } }) {
  const log = await prisma.tuneLog.findUnique({ where: { id: params.logId } });
  if (!log || log.vehicleId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(DATA_DIR, "tune-logs", params.id, log.filename);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const content = fs.readFileSync(filePath, "utf-8");
  return new NextResponse(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
