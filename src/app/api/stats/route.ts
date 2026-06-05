import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [vehicleCount, modCount, productCount, mods] = await Promise.all([
      prisma.vehicle.count(),
      prisma.modification.count(),
      prisma.trackedProduct.count(),
      prisma.modification.findMany({
        select: { status: true, price: true, actualPrice: true },
      }),
    ]);

    const totalPlanned = mods.reduce((sum, m) => sum + (m.price ?? 0), 0);
    const totalInstalled = mods
      .filter((m) => m.status === "INSTALLED")
      .reduce((sum, m) => sum + (m.actualPrice ?? m.price ?? 0), 0);
    const installedCount = mods.filter((m) => m.status === "INSTALLED").length;

    return NextResponse.json({
      vehicleCount,
      modCount,
      productCount,
      totalPlanned,
      totalInstalled,
      installedCount,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
