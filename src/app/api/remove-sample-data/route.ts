import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/remove-sample-data
 * Removes any vehicles that look like seeded sample data (name = "Example S2000"
 * or make = "Honda" + model = "S2000" + name starting with "Example"),
 * along with all their mods, maintenance logs, and budgets.
 */
export async function POST() {
  try {
    const sampleVehicles = await prisma.vehicle.findMany({
      where: {
        OR: [
          { name: "Example S2000" },
          { AND: [{ make: "Honda" }, { model: "S2000" }, { name: { startsWith: "Example" } }] },
        ],
      },
      select: { id: true },
    });

    if (sampleVehicles.length === 0) {
      return NextResponse.json({ removed: 0 });
    }

    const ids = sampleVehicles.map((v) => v.id);

    // Delete children first (SQLite FK safety)
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

    return NextResponse.json({ removed: sampleVehicles.length });
  } catch (err) {
    console.error("[remove-sample-data]", err);
    return NextResponse.json({ error: "Failed to remove sample data" }, { status: 500 });
  }
}
