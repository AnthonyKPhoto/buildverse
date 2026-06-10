import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const logs = await prisma.maintenanceLog.findMany({
      include: {
        vehicle: { select: { id: true, name: true, year: true, make: true, model: true } },
      },
      orderBy: { date: "desc" },
    });
    return NextResponse.json(logs);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/maintenance]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
