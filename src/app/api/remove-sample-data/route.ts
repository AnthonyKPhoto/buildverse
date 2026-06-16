import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    // Find sample vehicles by name pattern
    const sampleVehicles = await prisma.vehicle.findMany({
      where: {
        OR: [
          { name: { startsWith: "Example" } },
          { AND: [{ make: "Honda" }, { model: "S2000" }] },
        ],
      },
      select: { id: true },
    });

    const ids = sampleVehicles.map((v) => v.id);

    // Delete children of sample vehicles
    if (ids.length > 0) {
      await prisma.modDependency.deleteMany({
        where: {
          OR: [
            { mod: { vehicleId: { in: ids } } },
            { dependsOn: { vehicleId: { in: ids } } },
          ],
        },
      });
      await prisma.modification.deleteMany({ where: { vehicleId: { in: ids } } });
      await prisma.maintenanceLog.deleteMany({ where: { vehicleId: { in: ids } } });
      await prisma.budget.deleteMany({ where: { vehicleId: { in: ids } } });
      await prisma.vehicle.deleteMany({ where: { id: { in: ids } } });
    }

    // Also remove orphaned maintenance logs whose vehicle no longer exists
    const allLogs = await prisma.maintenanceLog.findMany({
      select: { id: true, vehicleId: true },
    });
    const allVehicleIds = new Set(
      (await prisma.vehicle.findMany({ select: { id: true } })).map((v) => v.id)
    );
    const orphanedLogIds = allLogs
      .filter((l) => !allVehicleIds.has(l.vehicleId))
      .map((l) => l.id);

    if (orphanedLogIds.length > 0) {
      await prisma.maintenanceLog.deleteMany({ where: { id: { in: orphanedLogIds } } });
    }

    return NextResponse.json({ removed: sampleVehicles.length, orphanedLogs: orphanedLogIds.length });
  } catch (err) {
    console.error("[remove-sample-data]", err);
    return NextResponse.json({ error: "Failed to remove sample data" }, { status: 500 });
  }
}
