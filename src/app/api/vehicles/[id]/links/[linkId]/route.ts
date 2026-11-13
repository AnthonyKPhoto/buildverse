import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isHttpUrl } from "@/lib/auth/safe-url";
import { canEditVehicle, VEHICLE_ACCESS_DENIED } from "@/lib/auth/vehicle-access";

export async function DELETE(req: NextRequest, { params }: { params: { id: string; linkId: string } }) {
  if (!(await canEditVehicle(req, params.id))) {
    return NextResponse.json(VEHICLE_ACCESS_DENIED, { status: 403 });
  }
  await prisma.vehicleLink.delete({ where: { id: params.linkId, vehicleId: params.id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string; linkId: string } }) {
  if (!(await canEditVehicle(req, params.id))) {
    return NextResponse.json(VEHICLE_ACCESS_DENIED, { status: 403 });
  }
  const body = await req.json();
  if (!isHttpUrl(body.url) || body.url.length > 2000) {
    return NextResponse.json({ error: "Link must be an http(s) URL" }, { status: 400 });
  }
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
