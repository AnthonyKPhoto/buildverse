import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(_: NextRequest, { params }: { params: { id: string; linkId: string } }) {
  await prisma.vehicleLink.delete({ where: { id: params.linkId, vehicleId: params.id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string; linkId: string } }) {
  const body = await req.json();
  const link = await prisma.vehicleLink.update({
    where: { id: params.linkId, vehicleId: params.id },
    data: {
      title: body.title?.trim(),
      url: body.url?.trim(),
      description: body.description?.trim() || null,
      category: body.category?.trim() || null,
    },
  });
  return NextResponse.json(link);
}
