import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { shareToken: params.token },
    include: {
      modifications: {
        where: { status: { not: "REMOVED" } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!vehicle) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(vehicle);
}
