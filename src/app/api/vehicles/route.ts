import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Accepts https:// URLs or base64 data: images uploaded from the client
const safeUrl = z
  .string()
  .max(10_000_000) // up to ~7.5 MB base64
  .refine(
    (u) => /^https?:\/\//i.test(u) || /^data:image\//i.test(u),
    "Only http/https URLs or data:image/ strings are allowed"
  );

const vehicleSchema = z.object({
  name:         z.string().max(100).optional(),
  year:         z.number().int().min(1900).max(2030),
  make:         z.string().min(1).max(100),
  model:        z.string().min(1).max(100),
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
  instagramUrl: z.string().url().max(500).optional().or(z.literal("")),
  facebookUrl:  z.string().url().max(500).optional().or(z.literal("")),
});

export async function GET() {
  try {
    const vehicles = await prisma.vehicle.findMany({
      include: {
        modifications: { select: { id: true, status: true, price: true, actualPrice: true } },
        budgets: { select: { id: true, category: true, planned: true, actual: true, notes: true } },
        _count: { select: { modifications: true, maintenanceLogs: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(vehicles);
  } catch {
    return NextResponse.json({ error: "Failed to fetch vehicles" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = vehicleSchema.parse(body);
    const vehicle = await prisma.vehicle.create({ data });
    return NextResponse.json(vehicle, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[POST /api/vehicles]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
