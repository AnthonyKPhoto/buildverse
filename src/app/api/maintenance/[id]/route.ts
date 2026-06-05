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
  } catch {
    return NextResponse.json({ error: "Failed to delete log" }, { status: 500 });
  }
}
