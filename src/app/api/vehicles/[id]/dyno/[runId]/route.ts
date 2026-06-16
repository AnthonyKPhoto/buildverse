import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; runId: string } }
) {
  await prisma.dynoRun.deleteMany({
    where: { id: params.runId, vehicleId: params.id },
  });
  return new NextResponse(null, { status: 204 });
}
