import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const links = await prisma.vehicleLink.findMany({
    where: { vehicleId: params.id },
    orderBy: [{ category: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(links);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { title, url, description, category } = await req.json();
  if (!title?.trim() || !url?.trim()) {
    return NextResponse.json({ error: "title and url are required" }, { status: 400 });
  }
  const link = await prisma.vehicleLink.create({
    data: { id: randomUUID(), vehicleId: params.id, title: title.trim(), url: url.trim(), description: description?.trim() || null, category: category?.trim() || null },
  });
  return NextResponse.json(link, { status: 201 });
}
