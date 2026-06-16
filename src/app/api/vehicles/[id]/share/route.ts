import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: params.id } });
  if (!vehicle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const token = vehicle.shareToken ?? uuidv4();
  const updated = await prisma.vehicle.update({
    where: { id: params.id },
    data: { shareToken: token },
    select: { shareToken: true },
  });
  return NextResponse.json({ token: updated.shareToken });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.vehicle.update({
    where: { id: params.id },
    data: { shareToken: null },
  });
  return new NextResponse(null, { status: 204 });
}
