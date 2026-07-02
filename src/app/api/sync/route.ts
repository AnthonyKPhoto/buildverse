import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const vehicles = await prisma.vehicle.findMany({
      include: {
        modifications:   { orderBy: { createdAt: "asc" } },
        maintenanceLogs: { orderBy: { date:      "asc" } },
        vehicleNotes:    { orderBy: { createdAt: "asc" } },
        links:           { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ version: 2, syncedAt: new Date().toISOString(), vehicles });
  } catch {
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const queue: Array<{ id: string; op: string; table: string; data: Record<string, unknown> }> =
      Array.isArray(body?.offlineQueue) ? body.offlineQueue : [];

    let merged = 0;

    for (const item of queue) {
      try {
        if (item.table === "vehicleNote") {
          const d = item.data;
          await prisma.vehicleNote.upsert({
            where: { id: String(d.id) },
            create: {
              id:         String(d.id),
              vehicleId:  String(d.vehicleId),
              title:      String(d.title      ?? ""),
              content:    String(d.content    ?? ""),
              color:      String(d.color      ?? "yellow"),
              importance: Number(d.importance ?? 0),
            },
            update: {
              title:      String(d.title      ?? ""),
              content:    String(d.content    ?? ""),
              color:      String(d.color      ?? "yellow"),
              importance: Number(d.importance ?? 0),
              updatedAt:  new Date(),
            },
          });
          merged++;
        } else if (item.table === "maintenanceLog") {
          const d = item.data;
          await prisma.maintenanceLog.upsert({
            where: { id: String(d.id) },
            create: {
              id:        String(d.id),
              vehicleId: String(d.vehicleId),
              service:   String(d.service),
              mileage:   d.mileage  != null ? Number(d.mileage)  : undefined,
              date:      new Date(String(d.date)),
              cost:      d.cost     != null ? Number(d.cost)     : undefined,
              notes:     d.notes    != null ? String(d.notes)    : undefined,
              shop:      d.shop     != null ? String(d.shop)     : undefined,
              diy:       Boolean(d.diy),
              nextDue:   d.nextDue  ? new Date(String(d.nextDue)) : undefined,
              nextMiles: d.nextMiles != null ? Number(d.nextMiles) : undefined,
            },
            update: {
              service:   String(d.service),
              mileage:   d.mileage != null  ? Number(d.mileage)  : undefined,
              date:      new Date(String(d.date)),
              cost:      d.cost    != null  ? Number(d.cost)     : undefined,
              notes:     d.notes   != null  ? String(d.notes)    : undefined,
              shop:      d.shop    != null  ? String(d.shop)     : undefined,
              diy:       Boolean(d.diy),
              updatedAt: new Date(),
            },
          });
          merged++;
        } else if (item.table === "modification" && item.op === "update") {
          const d = item.data;
          await prisma.modification.updateMany({
            where: { id: String(d.id) },
            data: {
              ...(d.status       != null && { status:        String(d.status) }),
              ...(d.notes        != null && { notes:         String(d.notes) }),
              ...(d.actualPrice  != null && { actualPrice:   Number(d.actualPrice) }),
              ...(d.installDate != null && { installDate:   new Date(String(d.installDate)) }),
              ...(d.installMileage != null && { installMileage: Number(d.installMileage) }),
              updatedAt: new Date(),
            },
          });
          merged++;
        }
      } catch { /* skip individual failures */ }
    }

    return NextResponse.json({ merged });
  } catch {
    return NextResponse.json({ error: "Merge failed" }, { status: 500 });
  }
}
