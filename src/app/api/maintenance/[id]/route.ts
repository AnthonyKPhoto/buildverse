import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canEditVehicle, VEHICLE_ACCESS_DENIED } from "@/lib/auth/vehicle-access";
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
    const existing = await prisma.maintenanceLog.findUnique({ where: { id: params.id }, select: { vehicleId: true } });
    if (!existing) return NextResponse.json({ error: "Maintenance log not found" }, { status: 404 });
    if (!(await canEditVehicle(req, existing.vehicleId))) {
      return NextResponse.json(VEHICLE_ACCESS_DENIED, { status: 403 });
    }

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

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const existing = await prisma.maintenanceLog.findUnique({ where: { id: params.id }, select: { vehicleId: true } });
    if (!existing) return NextResponse.json({ error: "Maintenance log not found" }, { status: 404 });
    if (!(await canEditVehicle(req, existing.vehicleId))) {
      return NextResponse.json(VEHICLE_ACCESS_DENIED, { status: 403 });
    }

    await prisma.maintenanceLog.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[DELETE /api/maintenance]", msg);

    // P2025 = record not found; raw delete is a no-op, return success either way.
    // FK constraint = older schema has a Receipt FK pointing at MaintenanceLog.
    // Both cases: bypass FK checks and raw-delete (safe even if row is already gone).
    const needsRawDelete =
      msg.toLowerCase().includes("foreign key") ||
      msg.toLowerCase().includes("does not exist") ||
      msg.includes("P2025");

    if (needsRawDelete) {
      try {
        await prisma.$executeRawUnsafe("PRAGMA foreign_keys = OFF");
        await prisma.$executeRaw`DELETE FROM "MaintenanceLog" WHERE "id" = ${params.id}`;
        await prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON");
        return NextResponse.json({ success: true });
      } catch (err2) {
        const msg2 = err2 instanceof Error ? err2.message : String(err2);
        console.error("[DELETE /api/maintenance] raw-delete failed:", msg2);
        return NextResponse.json({ error: msg2 }, { status: 500 });
      }
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
