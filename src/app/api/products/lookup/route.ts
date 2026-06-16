import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
