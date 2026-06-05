import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const maintenanceSchema = z.object({
  service:    z.string().min(1).max(255),
  mileage:    z.number().int().min(0).optional(),
  date:       z.string(),
  cost:       z.number().min(0).optional(),
  notes:      z.string().max(2000).optional(),
  shop:       z.string().max(255).optional(),
  diy:        z.boolean().optional(),
  nextDue:    z.string().optional(),
  nextMiles:  z.number().int().min(0).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const logs = await prisma.maintenanceLog.findMany({
      where: { vehicleId: params.id },
      orderBy: { date: "desc" },
    });
    return NextResponse.json(logs);
  } catch {
    return NextResponse.json({ error: "Failed to fetch maintenance logs" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const data = maintenanceSchema.parse(body);
    const log = await prisma.maintenanceLog.create({
      data: {
        vehicleId: params.id,
        ...data,
        date:    new Date(data.date),
        nextDue: data.nextDue ? new Date(data.nextDue) : undefined,
      },
    });
    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create maintenance log" }, { status: 500 });
  }
}
