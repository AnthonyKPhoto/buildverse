import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canEditVehicle, VEHICLE_ACCESS_DENIED } from "@/lib/auth/vehicle-access";

export async function PUT(req: NextRequest, { params }: { params: { id: string; noteId: string } }) {
  if (!(await canEditVehicle(req, params.id))) {
    return NextResponse.json(VEHICLE_ACCESS_DENIED, { status: 403 });
  }
  try {
    const { title, content, entryDate, mileage, pinned } = await req.json();
    const note = await prisma.vehicleNote.update({
      where: { id: params.noteId, vehicleId: params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(entryDate !== undefined && { entryDate: new Date(entryDate) }),
        ...(mileage !== undefined && { mileage: mileage != null ? Number(mileage) : null }),
        ...(pinned !== undefined && { pinned }),
      },
    });
    return NextResponse.json(note);
  } catch {
    return NextResponse.json({ error: "Failed to update note" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; noteId: string } }) {
  if (!(await canEditVehicle(req, params.id))) {
    return NextResponse.json(VEHICLE_ACCESS_DENIED, { status: 403 });
  }
  try {
    await prisma.vehicleNote.delete({ where: { id: params.noteId, vehicleId: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}
