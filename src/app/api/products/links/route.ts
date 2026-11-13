import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeProductUrl } from "@/lib/product-links";

export const dynamic = "force-dynamic";

// GET /api/products/links
// → { [productId]: [{ modId, modName, status, price, vehicleId, vehicleName }] }
// Which mods point at each tracked product (matched on the normalized URL), so
// the tracker can show "used on: 2020 WRX — Coilovers".
export async function GET() {
  const [products, mods] = await Promise.all([
    prisma.trackedProduct.findMany({ select: { id: true, url: true } }),
    prisma.modification.findMany({
      where: { link: { not: null } },
      select: {
        id: true, name: true, status: true, price: true, link: true, vehicleId: true,
        vehicle: { select: { name: true, year: true, make: true, model: true } },
      },
    }),
  ]);

  const byUrl = new Map<string, string>();
  for (const p of products) byUrl.set(normalizeProductUrl(p.url), p.id);

  const out: Record<string, unknown[]> = {};
  for (const m of mods) {
    const pid = byUrl.get(normalizeProductUrl(m.link));
    if (!pid) continue;
    (out[pid] ??= []).push({
      modId: m.id, modName: m.name, status: m.status, price: m.price, vehicleId: m.vehicleId,
      vehicleName: m.vehicle.name || `${m.vehicle.year} ${m.vehicle.make} ${m.vehicle.model}`,
    });
  }
  return NextResponse.json(out);
}
