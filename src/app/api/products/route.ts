import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scrapeProduct } from "@/lib/scraper";
import { z } from "zod";

// See src/app/api/health/route.ts for why this matters.
export const dynamic = "force-dynamic";

// Only http/https URLs up to 2 000 chars are accepted for scraping
const addProductSchema = z.object({
  url: z
    .string()
    .url("Must be a valid URL")
    .max(2000, "URL must be 2 000 characters or fewer")
    .refine(
      (u) => /^https?:\/\//i.test(u),
      "Only http and https URLs are allowed"
    ),
});

export async function GET() {
  try {
    const products = await prisma.trackedProduct.findMany({
      include: {
        priceHistory: { orderBy: { createdAt: "desc" }, take: 30 },
      },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(products);
  } catch {
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = addProductSchema.parse(body);

    const existing = await prisma.trackedProduct.findUnique({ where: { url } });
    if (existing) {
      return NextResponse.json(
        { error: "Product already tracked", product: existing },
        { status: 409 }
      );
    }

    // scrapeProduct performs SSRF validation internally before fetching
    const scraped = await scrapeProduct(url);

    const product = await prisma.trackedProduct.create({
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
      include: { priceHistory: true },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    // Surface SSRF / validation errors from scrapeProduct as 400
    if (
      error instanceof Error &&
      (error.message.includes("private") ||
        error.message.includes("loopback") ||
        error.message.includes("hostname") ||
        error.message.includes("Only http"))
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to track product" }, { status: 500 });
  }
}
