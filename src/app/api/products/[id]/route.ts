import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  alertThreshold: z.number().min(0).max(10_000_000).nullable().optional(),
  notifyEmail: z.boolean().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = updateSchema.parse(await req.json());
    const updated = await prisma.trackedProduct.update({
      where: { id: params.id },
      data: {
        ...(body.alertThreshold !== undefined && {
          alertThreshold: body.alertThreshold,
          // A new target re-arms the email so it can fire again
          lastNotifiedPrice: null,
        }),
        ...(body.notifyEmail !== undefined && { notifyEmail: body.notifyEmail }),
      },
      include: { priceHistory: { orderBy: { createdAt: "desc" }, take: 60 } },
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.trackedProduct.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
