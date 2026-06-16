import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const products = await prisma.trackedProduct.findMany({
    where: {
      alertThreshold: { not: null },
      currentPrice:   { not: null },
    },
    select: { id: true, title: true, currentPrice: true, alertThreshold: true, url: true },
  });

  const triggered = products.filter(
    (p) => p.currentPrice != null && p.alertThreshold != null && p.currentPrice <= p.alertThreshold
  );

  return NextResponse.json(triggered);
}
