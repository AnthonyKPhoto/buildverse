import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/modifications/:id/dependencies — list deps (ids of mods this one depends on) */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const deps = await prisma.modDependency.findMany({
      where: { modId: params.id },
      include: { dependsOn: { select: { id: true, name: true, category: true, status: true } } },
    });
    return NextResponse.json(deps.map((d) => d.dependsOn));
  } catch {
    return NextResponse.json({ error: "Failed to fetch dependencies" }, { status: 500 });
  }
}

/** POST /api/modifications/:id/dependencies  body: { dependsOnId: string } */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { dependsOnId } = await req.json();
    if (!dependsOnId || dependsOnId === params.id) {
      return NextResponse.json({ error: "Invalid dependsOnId" }, { status: 400 });
    }
    await prisma.modDependency.upsert({
      where: { modId_dependsOnId: { modId: params.id, dependsOnId } },
      create: { modId: params.id, dependsOnId },
      update: {},
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to add dependency" }, { status: 500 });
  }
}

/** DELETE /api/modifications/:id/dependencies  body: { dependsOnId: string } */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { dependsOnId } = await req.json();
    await prisma.modDependency.deleteMany({
      where: { modId: params.id, dependsOnId },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to remove dependency" }, { status: 500 });
  }
}
