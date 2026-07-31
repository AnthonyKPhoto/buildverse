import { NextRequest, NextResponse } from "next/server";
import { scrapeProduct } from "@/lib/scraper";

// See src/app/api/health/route.ts for why this matters.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ imageUrl: null });
  try {
    const result = await scrapeProduct(url);
    return NextResponse.json({ imageUrl: result.imageUrl });
  } catch {
    return NextResponse.json({ imageUrl: null });
  }
}
