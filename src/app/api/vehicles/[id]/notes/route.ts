import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canEditVehicle, VEHICLE_ACCESS_DENIED } from "@/lib/auth/vehicle-access";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const notes = await prisma.vehicleNote.findMany({
      where: { vehicleId: params.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(notes);
  } catch {
    return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await canEditVehicle(req, params.id))) {
    return NextResponse.json(VEHICLE_ACCESS_DENIED, { status: 403 });
  }
  try {
    const { title, content, color, importance } = await req.json();
    const note = await prisma.vehicleNote.create({
      data: {
        vehicleId: params.id,
        title: title ?? "",
        content: content ?? "",
        color: color ?? "yellow",
        importance: importance ?? 0,
      },
    });
    return NextResponse.json(note);
  } catch {
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
}
