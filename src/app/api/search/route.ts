import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// See src/app/api/health/route.ts for why this matters.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ vehicles: [], modifications: [], maintenance: [], products: [] });
  }

  const [vehicles, modifications, maintenance, products] = await Promise.all([
    prisma.vehicle.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { make: { contains: q } },
          { model: { contains: q } },
          { platform: { contains: q } },
        ],
      },
      select: { id: true, name: true, year: true, make: true, model: true, trim: true },
      take: 5,
    }),
    prisma.modification.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { brand: { contains: q } },
          { vendor: { contains: q } },
          { category: { contains: q } },
          { partNumber: { contains: q } },
        ],
      },
      select: {
        id: true, name: true, status: true, category: true, vehicleId: true,
        vehicle: { select: { id: true, name: true, year: true, make: true, model: true } },
      },
      take: 10,
    }),
    prisma.maintenanceLog.findMany({
      where: {
        OR: [{ service: { contains: q } }, { notes: { contains: q } }, { shop: { contains: q } }],
      },
      select: {
        id: true, service: true, vehicleId: true,
        vehicle: { select: { id: true, name: true, year: true, make: true, model: true } },
      },
      take: 6,
    }),
    prisma.trackedProduct.findMany({
      where: {
        OR: [{ title: { contains: q } }, { brand: { contains: q } }, { vendor: { contains: q } }],
      },
      select: { id: true, title: true, currentPrice: true, vendor: true, brand: true },
      take: 6,
    }),
  ]);

  return NextResponse.json({ vehicles, modifications, maintenance, products });
}
