import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const vehicles = await prisma.vehicle.findMany({
      select: { id: true, name: true, year: true, make: true, model: true, trim: true },
      orderBy: { createdAt: "desc" },
    });

    const modifications = await prisma.modification.findMany({
      include: { vehicle: { select: { id: true, name: true, year: true, make: true, model: true } } },
      orderBy: [{ category: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ vehicles, modifications });
  } catch {
    return NextResponse.json({ error: "Failed to fetch builds" }, { status: 500 });
  }
}
