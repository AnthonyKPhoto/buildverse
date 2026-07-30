import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canEditVehicle, VEHICLE_ACCESS_DENIED } from "@/lib/auth/vehicle-access";

// GET: list of mods that [id] depends on
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const deps = await prisma.modDependency.findMany({
    where: { modId: params.id },
    include: { dependsOn: { select: { id: true, name: true, status: true, category: true } } },
  });
  return NextResponse.json(deps.map((d) => d.dependsOn));
}

// PUT: replace full dependency list for [id]
// Body: { dependsOn: string[] }  — array of mod IDs this mod requires
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const existing = await prisma.modification.findUnique({ where: { id: params.id }, select: { vehicleId: true } });
  if (!existing) return NextResponse.json({ error: "Modification not found" }, { status: 404 });
  if (!(await canEditVehicle(req, existing.vehicleId))) {
    return NextResponse.json(VEHICLE_ACCESS_DENIED, { status: 403 });
  }

  const { dependsOn } = await req.json() as { dependsOn: string[] };

  if (!Array.isArray(dependsOn)) {
    return NextResponse.json({ error: "dependsOn must be an array" }, { status: 400 });
  }

  // Prevent self-dependency
  const filtered = dependsOn.filter((id) => id !== params.id);

  await prisma.modDependency.deleteMany({ where: { modId: params.id } });

  for (const depId of filtered) {
    await prisma.modDependency.create({
      data: { modId: params.id, dependsOnId: depId },
    });
  }

  return NextResponse.json({ ok: true, count: filtered.length });
}
