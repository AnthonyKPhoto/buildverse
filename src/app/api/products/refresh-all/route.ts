import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshProduct } from "@/lib/price-tracker";

export const maxDuration = 300;

/**
 * POST /api/products/refresh-all
 * Re-scrapes every tracked product (a few at a time) and returns the updated
 * list. Uses the shared refreshProduct(), which — unlike the old inline code —
 * keeps each product's all-time low/high and never overwrites a good price or
 * title when a fetch fails.
 */
export async function POST() {
  try {
    const ids = (await prisma.trackedProduct.findMany({ select: { id: true } })).map((p) => p.id);
    let i = 0;
    await Promise.all(
      Array.from({ length: Math.min(3, ids.length) }, async () => {
        while (i < ids.length) await refreshProduct(ids[i++]).catch(() => null);
      })
    );
    const updated = await prisma.trackedProduct.findMany({
      include: { priceHistory: { orderBy: { createdAt: "desc" }, take: 60 } },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Refresh all failed" }, { status: 500 });
  }
}
