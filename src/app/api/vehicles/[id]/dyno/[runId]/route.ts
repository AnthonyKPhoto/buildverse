import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canEditVehicle, VEHICLE_ACCESS_DENIED } from "@/lib/auth/vehicle-access";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; runId: string } }
) {
  if (!(await canEditVehicle(req, params.id))) {
    return NextResponse.json(VEHICLE_ACCESS_DENIED, { status: 403 });
  }
  await prisma.dynoRun.deleteMany({
    where: { id: params.runId, vehicleId: params.id },
  });
  return new NextResponse(null, { status: 204 });
}
