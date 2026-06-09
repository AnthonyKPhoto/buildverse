import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scrapeProduct } from "@/lib/scraper";

/**
 * POST /api/products/sync
 * Finds all modification links in the DB and tracks any that aren't already
 * in the product tracker.  Returns { added, skipped, failed }.
 */
export async function POST() {
  try {
    // Gather every unique https link from modifications
    const mods = await prisma.modification.findMany({
      where: { link: { not: null } },
      select: { link: true },
    });

    const seen = new Set<string>();
    const urls: string[] = [];
    for (const m of mods) {
      const u = m.link!;
      if (/^https?:\/\//i.test(u) && !seen.has(u)) {
        seen.add(u);
        urls.push(u);
      }
    }

    if (urls.length === 0) {
      return NextResponse.json({ added: 0, skipped: 0, failed: 0 });
    }

    // Which are already tracked?
    const existing = await prisma.trackedProduct.findMany({
      where: { url: { in: urls } },
      select: { url: true },
    });
    const existingUrls = new Set(existing.map((p) => p.url));

    const toAdd = urls.filter((u) => !existingUrls.has(u));
    let added = 0;
    let failed = 0;

    for (const url of toAdd) {
      try {
        const scraped = await scrapeProduct(url);
        await prisma.trackedProduct.create({
          data: {
            url,
            title: scraped.title,
            brand: scraped.brand,
            imageUrl: scraped.imageUrl,
            description: scraped.description,
            currentPrice: scraped.price,
            lowestPrice: scraped.price,
            highestPrice: scraped.price,
            vendor: scraped.vendor,
            availability: scraped.availability,
            sku: scraped.sku,
            lastChecked: new Date(),
            priceHistory: scraped.price ? { create: { price: scraped.price } } : undefined,
          },
        });
        added++;
      } catch {
        failed++;
      }
    }

    return NextResponse.json({ added, skipped: existingUrls.size, failed });
  } catch {
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
