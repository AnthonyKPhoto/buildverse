import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// PUT /api/products/bulk-alert
// Body: { mode: "fixed", value: number }  — set every alert to a fixed price
//       { mode: "pct",   value: number }  — alert = currentPrice × (1 − value/100)
//       { mode: "clear" }                 — remove all alerts
// Optional: { notifyEmail: boolean } also turns email on/off for every product.
const schema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("fixed"), value: z.number().min(0).max(10_000_000), notifyEmail: z.boolean().optional() }),
  z.object({ mode: z.literal("pct"), value: z.number().min(0).max(100), notifyEmail: z.boolean().optional() }),
  z.object({ mode: z.literal("clear"), notifyEmail: z.boolean().optional() }),
]);

export async function PUT(req: NextRequest) {
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const products = await prisma.trackedProduct.findMany({ select: { id: true, currentPrice: true } });

  await prisma.$transaction(
    products.map((p) => {
      let threshold: number | null = null;
      if (body.mode === "fixed") threshold = body.value;
      else if (body.mode === "pct" && p.currentPrice != null) {
        threshold = parseFloat((p.currentPrice * (1 - body.value / 100)).toFixed(2));
      }
      // pct with no known price: leave that product's alert untouched
      const skip = body.mode === "pct" && p.currentPrice == null;
      return prisma.trackedProduct.update({
        where: { id: p.id },
        data: {
          ...(skip ? {} : { alertThreshold: threshold, lastNotifiedPrice: null }),
          ...(body.notifyEmail !== undefined && { notifyEmail: body.notifyEmail }),
        },
      });
    })
  );

  const updated = await prisma.trackedProduct.findMany({
    include: { priceHistory: { orderBy: { createdAt: "desc" }, take: 60 } },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(updated);
}
