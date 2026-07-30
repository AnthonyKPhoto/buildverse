import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Nullable + optional on every field that's nullable in the Prisma schema —
// a GET-then-POST round trip (JSON export/import) gets `null` back for unset
// fields, not `undefined`, and .optional() alone rejects null.
const maintenanceSchema = z.object({
  service:    z.string().min(1).max(255),
  mileage:    z.number().int().min(0).nullable().optional(),
  date:       z.string(),
  cost:       z.number().min(0).nullable().optional(),
  notes:      z.string().max(2000).nullable().optional(),
  shop:       z.string().max(255).nullable().optional(),
  diy:        z.boolean().optional(), // non-nullable in Prisma (@default(false))
  nextDue:    z.string().nullable().optional(),
  nextMiles:  z.number().int().min(0).nullable().optional(),
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
