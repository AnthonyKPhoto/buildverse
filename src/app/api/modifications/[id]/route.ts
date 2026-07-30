import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canEditVehicle, VEHICLE_ACCESS_DENIED } from "@/lib/auth/vehicle-access";
import { z } from "zod";

const safeUrl = z
  .string()
  .max(10_000_000)
  .refine(
    (u) => /^https?:\/\//i.test(u) || /^data:image\//i.test(u),
    "Only http/https URLs or data:image/ strings are allowed"
  );

const modUpdateSchema = z.object({
  name:           z.string().max(255).optional(),
  category:       z.string().max(100).optional(),
  vendor:         z.string().max(255).optional(),
  brand:          z.string().max(255).optional(),
  price:          z.number().min(0).optional().nullable(),
  actualPrice:    z.number().min(0).optional().nullable(),
  notes:          z.string().max(10000).optional(),
  priority:       z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  status:         z.enum(["PLANNED", "RESEARCHING", "ORDERED", "PURCHASED", "INSTALLED", "REMOVED"]).optional(),
  link:           safeUrl.optional().nullable(),
  imageUrl:       safeUrl.optional().nullable(),
  difficulty:     z.string().max(50).optional(),
  installDate:    z.string().optional().nullable(),
  installMileage: z.number().int().min(0).optional().nullable(),
  laborCost:      z.number().min(0).optional().nullable(),
  diyInstall:     z.boolean().optional(),
  partNumber:     z.string().max(100).optional(),
  orderNumber:    z.string().max(100).optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const existing = await prisma.modification.findUnique({ where: { id: params.id }, select: { vehicleId: true } });
    if (!existing) return NextResponse.json({ error: "Modification not found" }, { status: 404 });
    if (!(await canEditVehicle(req, existing.vehicleId))) {
      return NextResponse.json(VEHICLE_ACCESS_DENIED, { status: 403 });
    }

    const body = await req.json();
    const data = modUpdateSchema.parse(body);
    const mod = await prisma.modification.update({
      where: { id: params.id },
      data: {
        ...data,
        installDate:
          data.installDate
            ? new Date(data.installDate)
            : data.installDate === null
              ? null
              : undefined,
      },
    });
    return NextResponse.json(mod);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update modification" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const existing = await prisma.modification.findUnique({ where: { id: params.id }, select: { vehicleId: true } });
    if (!existing) return NextResponse.json({ error: "Modification not found" }, { status: 404 });
    if (!(await canEditVehicle(req, existing.vehicleId))) {
      return NextResponse.json(VEHICLE_ACCESS_DENIED, { status: 403 });
    }

    // Remove dependency rows referencing this mod on either side before deleting
    // (SQLite doesn't cascade FK deletes automatically)
    await prisma.modDependency.deleteMany({
      where: { OR: [{ modId: params.id }, { dependsOnId: params.id }] },
    });
    await prisma.modification.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/modifications]", err);
    return NextResponse.json({ error: "Failed to delete modification" }, { status: 500 });
  }
}
