import { NextRequest, NextResponse } from "next/server";
import { scrapeProduct } from "@/lib/scraper";

// See src/app/api/health/route.ts for why this matters.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url parameter required" }, { status: 400 });

  try {
    const data = await scrapeProduct(url);
    return NextResponse.json({
      name:        data.title,
      brand:       data.brand,
      vendor:      data.vendor,
      price:       data.price,
      imageUrl:    data.imageUrl,
      notes:       data.description,
      partNumber:  data.sku,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes("private") || msg.includes("loopback") || msg.includes("Only http") ? 400 : 422;
    return NextResponse.json({ error: msg }, { status });
  }
}
