import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
  try {
    const { title, content, color } = await req.json();
    const note = await prisma.vehicleNote.create({
      data: {
        vehicleId: params.id,
        title: title ?? "",
        content: content ?? "",
        color: color ?? "yellow",
      },
    });
    return NextResponse.json(note);
  } catch {
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
}
