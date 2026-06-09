import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const safeUrl = z
  .string()
  .max(10_000_000)
  .refine(
    (u) => /^https?:\/\//i.test(u) || /^data:image\//i.test(u),
    "Only http/https URLs or data:image/ strings are allowed"
  );

const vehicleUpdateSchema = z.object({
  name:         z.string().max(100).optional(),
  year:         z.number().int().min(1900).max(2030).optional(),
  make:         z.string().max(100).optional(),
  model:        z.string().max(100).optional(),
  trim:         z.string().max(100).optional(),
  engine:       z.string().max(100).optional(),
  transmission: z.string().max(100).optional(),
  drivetrain:   z.string().max(50).optional(),
  vin:          z.string().max(17).optional(),
  mileage:      z.number().int().min(0).optional(),
  platform:     z.string().max(100).optional(),
  color:        z.string().max(100).optional(),
  photoUrl:     safeUrl.optional(),
  notes:        z.string().max(2000).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: params.id },
      include: {
        modifications: { orderBy: [{ category: "asc" }, { createdAt: "desc" }] },
        maintenanceLogs: { orderBy: { date: "desc" } },
        budgets: true,
      },
    });
    if (!vehicle) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(vehicle);
  } catch {
    return NextResponse.json({ error: "Failed to fetch vehicle" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const data = vehicleUpdateSchema.parse(body);
    const vehicle = await prisma.vehicle.update({ where: { id: params.id }, data });
    return NextResponse.json(vehicle);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[PUT /api/vehicles/[id]]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.vehicle.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete vehicle" }, { status: 500 });
  }
}
