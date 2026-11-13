import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/wipe
 * Deletes ALL user data in the correct dependency order.
 * Using deleteMany directly avoids FK/cascade issues with SQLite.
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req, true);
  if (denied) return denied;
  try {
    // Delete in FK-safe order: children first, parents last
    await prisma.modDependency.deleteMany({});
    await prisma.modification.deleteMany({});
    await prisma.maintenanceLog.deleteMany({});
    await prisma.budget.deleteMany({});
    await prisma.vehicle.deleteMany({});
    await prisma.priceHistory.deleteMany({});
    await prisma.trackedProduct.deleteMany({});

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[wipe]", err);
    return NextResponse.json({ error: "Wipe failed" }, { status: 500 });
  }
}
