import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import path from "path";
import fs from "fs";

function filesRoot(): string {
  return process.env.BUILDVERSE_DATA_DIR
    ? path.join(process.env.BUILDVERSE_DATA_DIR, "vehicle-files")
    : path.join(process.cwd(), "data", "vehicle-files");
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  const record = await prisma.vehicleFile.findFirst({
    where: { id: params.fileId, vehicleId: params.id },
  });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const filePath = path.join(filesRoot(), params.id, record.filename);
  try { fs.unlinkSync(filePath); } catch { /* file may already be gone */ }

  await prisma.vehicleFile.delete({ where: { id: params.fileId } });

  return new NextResponse(null, { status: 204 });
}
