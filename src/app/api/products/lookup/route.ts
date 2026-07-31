import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// See src/app/api/health/route.ts for why this matters.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")?.trim();
  if (!url) return NextResponse.json({ product: null });

  const product = await prisma.trackedProduct.findFirst({
    where: { url },
    select: {
      id: true, title: true, currentPrice: true, lowestPrice: true,
      highestPrice: true, alertThreshold: true, imageUrl: true,
    },
  });
  return NextResponse.json({ product });
}
