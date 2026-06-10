import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  service:    z.string().max(255).optional(),
  mileage:    z.number().int().min(0).optional().nullable(),
  date:       z.string().optional(),
  cost:       z.number().min(0).optional().nullable(),
  notes:      z.string().max(2000).optional(),
  shop:       z.string().max(255).optional(),
  diy:        z.boolean().optional(),
  nextDue:    z.string().optional().nullable(),
  nextMiles:  z.number().int().min(0).optional().nullable(),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const data = updateSchema.parse(body);
    const log = await prisma.maintenanceLog.update({
      where: { id: params.id },
      data: {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
        nextDue: data.nextDue ? new Date(data.nextDue) : data.nextDue === null ? null : undefined,
      },
    });
    return NextResponse.json(log);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update log" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.maintenanceLog.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[DELETE /api/maintenance]", msg);

    // Older DB schemas may have a Receipt table with a FK pointing at MaintenanceLog.
    // If that FK constraint blocks the delete, disable FK checks, retry, then re-enable.
    if (msg.toLowerCase().includes("foreign key")) {
      try {
        await prisma.$executeRawUnsafe("PRAGMA foreign_keys = OFF");
        await prisma.$executeRaw`DELETE FROM "MaintenanceLog" WHERE "id" = ${params.id}`;
        await prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON");
        return NextResponse.json({ success: true });
      } catch (err2) {
        const msg2 = err2 instanceof Error ? err2.message : String(err2);
        console.error("[DELETE /api/maintenance] FK-bypass failed:", msg2);
        return NextResponse.json({ error: msg2 }, { status: 500 });
      }
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
