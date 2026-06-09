import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scrapeProduct } from "@/lib/scraper";

/**
 * POST /api/products/refresh-all
 * Re-scrapes every tracked product and updates prices.
 * Returns the full updated product list.
 */
export async function POST() {
  try {
    const products = await prisma.trackedProduct.findMany({ select: { id: true, url: true } });

    const results = await Promise.allSettled(
      products.map(async (p) => {
        try {
          const scraped = await scrapeProduct(p.url);
          return await prisma.trackedProduct.update({
            where: { id: p.id },
            data: {
              title: scraped.title || undefined,
              brand: scraped.brand || undefined,
              imageUrl: scraped.imageUrl || undefined,
              description: scraped.description || undefined,
              currentPrice: scraped.price,
              lowestPrice:
                scraped.price != null
                  ? { set: scraped.price } // handled below
                  : undefined,
              availability: scraped.availability || undefined,
              lastChecked: new Date(),
              priceHistory: scraped.price ? { create: { price: scraped.price } } : undefined,
            },
            include: { priceHistory: { orderBy: { createdAt: "desc" }, take: 30 } },
          });
        } catch {
          return null;
        }
      })
    );

    // Update lowest/highest manually (Prisma doesn't support conditional set)
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        const p = r.value;
        if (p.currentPrice != null) {
          const updates: Record<string, unknown> = {};
          if (p.lowestPrice == null || p.currentPrice < p.lowestPrice) updates.lowestPrice = p.currentPrice;
          if (p.highestPrice == null || p.currentPrice > p.highestPrice) updates.highestPrice = p.currentPrice;
          if (Object.keys(updates).length > 0) {
            await prisma.trackedProduct.update({ where: { id: p.id }, data: updates });
          }
        }
      }
    }

    const updated = await prisma.trackedProduct.findMany({
      include: { priceHistory: { orderBy: { createdAt: "desc" }, take: 30 } },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Refresh all failed" }, { status: 500 });
  }
}
