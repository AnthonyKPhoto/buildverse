import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canEditVehicle, VEHICLE_ACCESS_DENIED } from "@/lib/auth/vehicle-access";
import { normalizeProductUrl, isDoneStatus } from "@/lib/product-links";
import { trackUrl } from "@/lib/price-tracker";

export const dynamic = "force-dynamic";

// GET → { [modId]: tracked product summary } for every mod on this vehicle whose
// link is being price-tracked. One call replaces a lookup per mod.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const [mods, products] = await Promise.all([
    prisma.modification.findMany({ where: { vehicleId: params.id, link: { not: null } }, select: { id: true, link: true } }),
    prisma.trackedProduct.findMany({
      select: {
        id: true, url: true, currentPrice: true, previousPrice: true, lowestPrice: true, highestPrice: true,
        alertThreshold: true, availability: true, lastError: true, compareGroup: true,
      },
    }),
  ]);
  const byUrl = new Map(products.map((p) => [normalizeProductUrl(p.url), p]));
  const out: Record<string, unknown> = {};
  for (const m of mods) {
    const p = byUrl.get(normalizeProductUrl(m.link));
    if (p) out[m.id] = p;
  }
  return NextResponse.json(out);
}

// POST { modId } → start tracking that mod's link
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await canEditVehicle(req, params.id))) {
    return NextResponse.json(VEHICLE_ACCESS_DENIED, { status: 403 });
  }
  try {
    const { modId } = z.object({ modId: z.string().min(1) }).parse(await req.json());
    const mod = await prisma.modification.findFirst({ where: { id: modId, vehicleId: params.id }, select: { link: true, status: true } });
    if (mod && isDoneStatus(mod.status)) {
      return NextResponse.json({ error: "This mod is already purchased, installed or removed — nothing left to price-watch" }, { status: 400 });
    }
    if (!mod?.link || !/^https?:\/\//i.test(mod.link)) {
      return NextResponse.json({ error: "This mod doesn't have a product link to track" }, { status: 400 });
    }
    const { product, created } = await trackUrl(mod.link);
    return NextResponse.json({ product, created }, { status: created ? 201 : 200 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const msg = error instanceof Error ? error.message : "";
    const blocked = /private|loopback|hostname|Only http/i.test(msg);
    return NextResponse.json({ error: blocked ? msg : "Couldn't start tracking that link" }, { status: blocked ? 400 : 500 });
  }
}
