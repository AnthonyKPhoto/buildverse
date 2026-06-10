import { NextRequest, NextResponse } from "next/server";
import { scrapeProduct } from "@/lib/scraper";

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
