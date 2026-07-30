import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Admin-only management of per-vehicle edit grants. Viewing stays shared for
// everyone — this only controls who besides a vehicle's creator (and admins,
// who always bypass) may edit it. See src/lib/auth/vehicle-access.ts.

function requireAdmin(req: NextRequest): NextResponse | null {
  if (req.headers.get("x-user-role") !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const [vehicles, users, grants] = await Promise.all([
    prisma.vehicle.findMany({
      select: { id: true, name: true, year: true, make: true, model: true, createdByUserId: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({ select: { id: true, username: true, role: true }, orderBy: { username: "asc" } }),
    prisma.vehicleAccess.findMany({ select: { vehicleId: true, userId: true } }),
  ]);
  return NextResponse.json({ vehicles, users, grants });
}

const grantSchema = z.object({ vehicleId: z.string().min(1), userId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const { vehicleId, userId } = grantSchema.parse(await req.json());
    await prisma.vehicleAccess.upsert({
      where: { vehicleId_userId: { vehicleId, userId } },
      update: {},
      create: { vehicleId, userId },
    });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to grant access" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const { vehicleId, userId } = grantSchema.parse(await req.json());
    await prisma.vehicleAccess.delete({ where: { vehicleId_userId: { vehicleId, userId } } }).catch(() => {});
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to revoke access" }, { status: 500 });
  }
}
