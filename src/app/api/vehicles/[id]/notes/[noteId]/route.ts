import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string; noteId: string } }) {
  try {
    const { title, content, color } = await req.json();
    const note = await prisma.vehicleNote.update({
      where: { id: params.noteId },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(color !== undefined && { color }),
      },
    });
    return NextResponse.json(note);
  } catch {
    return NextResponse.json({ error: "Failed to update note" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { noteId: string } }) {
  try {
    await prisma.vehicleNote.delete({ where: { id: params.noteId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}
