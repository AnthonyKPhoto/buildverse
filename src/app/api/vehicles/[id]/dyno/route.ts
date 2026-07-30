import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canEditVehicle, VEHICLE_ACCESS_DENIED } from "@/lib/auth/vehicle-access";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

const schema = z.object({
  date:   z.string(),
  hp:     z.number().nullable().optional(),
  torque: z.number().nullable().optional(),
  label:  z.string().max(100).optional(),
  notes:  z.string().max(2000).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const runs = await prisma.dynoRun.findMany({
    where: { vehicleId: params.id },
    orderBy: { date: "asc" },
  });
  return NextResponse.json(runs);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await canEditVehicle(req, params.id))) {
    return NextResponse.json(VEHICLE_ACCESS_DENIED, { status: 403 });
  }
  const body = await req.json();
  const data = schema.parse(body);
  const run = await prisma.dynoRun.create({
    data: {
      id: uuidv4(),
      vehicleId: params.id,
      date: new Date(data.date),
      hp: data.hp ?? null,
      torque: data.torque ?? null,
      label: data.label ?? null,
      notes: data.notes ?? null,
    },
  });
  return NextResponse.json(run, { status: 201 });
}
