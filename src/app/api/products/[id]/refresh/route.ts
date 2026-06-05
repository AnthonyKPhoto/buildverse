import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scrapeProduct } from "@/lib/scraper";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const product = await prisma.trackedProduct.findUnique({ where: { id: params.id } });
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const scraped = await scrapeProduct(product.url);

    const updated = await prisma.trackedProduct.update({
      where: { id: params.id },
      data: {
        title: scraped.title || product.title,
        brand: scraped.brand || product.brand,
        imageUrl: scraped.imageUrl || product.imageUrl,
        description: scraped.description || product.description,
        currentPrice: scraped.price,
        lowestPrice:
          scraped.price != null && (product.lowestPrice == null || scraped.price < product.lowestPrice)
            ? scraped.price
            : product.lowestPrice,
        highestPrice:
          scraped.price != null && (product.highestPrice == null || scraped.price > product.highestPrice)
            ? scraped.price
            : product.highestPrice,
        availability: scraped.availability || product.availability,
        lastChecked: new Date(),
        priceHistory: scraped.price
          ? { create: { price: scraped.price } }
          : undefined,
      },
      include: { priceHistory: { orderBy: { createdAt: "desc" }, take: 30 } },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to refresh product" }, { status: 500 });
  }
}
