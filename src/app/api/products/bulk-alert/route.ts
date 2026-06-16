import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT /api/products/bulk-alert
// Body: { mode: "fixed", value: number }  — set all thresholds to a fixed price
//       { mode: "pct",   value: number }  — set threshold = currentPrice * (1 - value/100)
export async function PUT(req: NextRequest) {
  const { mode, value } = await req.json() as { mode: "fixed" | "pct"; value: number };

  if (!["fixed", "pct"].includes(mode) || typeof value !== "number" || value < 0) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const products = await prisma.trackedProduct.findMany({
    select: { id: true, currentPrice: true },
  });

  await Promise.all(
    products.map(async (p) => {
      let threshold: number | null = null;
      if (mode === "fixed") {
        threshold = value;
      } else {
        if (p.currentPrice == null) return;
        threshold = parseFloat((p.currentPrice * (1 - value / 100)).toFixed(2));
      }
      await prisma.trackedProduct.update({
        where: { id: p.id },
        data: { alertThreshold: threshold },
      });
    })
  );

  const updated = await prisma.trackedProduct.findMany({ include: { priceHistory: true } });
  return NextResponse.json(updated);
}
