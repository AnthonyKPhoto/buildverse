import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// See src/app/api/health/route.ts for why this matters — this is the
// garage's own vehicle list, so a build-time-cached response here would
// show a permanently stale/empty garage in Docker.
export const dynamic = "force-dynamic";

// Accepts https:// URLs or base64 data: images uploaded from the client
const safeUrl = z
  .string()
  .max(10_000_000) // up to ~7.5 MB base64
  .refine(
    (u) => /^https?:\/\//i.test(u) || /^data:image\//i.test(u),
    "Only http/https URLs or data:image/ strings are allowed"
  );

// Nullable + optional on every field that's nullable in the Prisma schema —
// a GET-then-POST round trip (JSON export/import) gets `null` back for unset
// fields, not `undefined`, and .optional() alone rejects null.
const vehicleSchema = z.object({
  name:         z.string().max(100).nullable().optional(),
  year:         z.number().int().min(1900).max(2030),
  make:         z.string().min(1).max(100),
  model:        z.string().min(1).max(100),
  trim:         z.string().max(100).nullable().optional(),
  engine:       z.string().max(100).nullable().optional(),
  transmission: z.string().max(100).nullable().optional(),
  drivetrain:   z.string().max(50).nullable().optional(),
  vin:          z.string().max(17).nullable().optional(),
  mileage:      z.number().int().min(0).nullable().optional(),
  platform:     z.string().max(100).nullable().optional(),
  color:        z.string().max(100).nullable().optional(),
  photoUrl:     safeUrl.nullable().optional(),
  notes:        z.string().max(2000).nullable().optional(),
  instagramUrl: z.string().url().max(500).nullable().optional().or(z.literal("")),
  facebookUrl:  z.string().url().max(500).nullable().optional().or(z.literal("")),
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
    // Null in local/Electron mode (no x-user-id header there) — the creator
    // always keeps edit access on top of whatever VehicleAccess grants an
    // admin adds later, see src/lib/auth/vehicle-access.ts.
    const createdByUserId = req.headers.get("x-user-id");
    const vehicle = await prisma.vehicle.create({ data: { ...data, ...(createdByUserId ? { createdByUserId } : {}) } });
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
