import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import path from "path";
import fs from "fs";
import { v4 as uuid } from "uuid";

const DATA_DIR = process.env.BUILDVERSE_DATA_DIR || path.join(process.cwd(), "data");

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const logs = await prisma.tuneLog.findMany({
    where: { vehicleId: params.id },
    orderBy: { uploadedAt: "desc" },
  });
  return NextResponse.json(logs);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const name = (formData.get("name") as string | null)?.trim() || "";

    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
    if (file.size > 50 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 50 MB)" }, { status: 413 });

    const id = uuid();
    const ext = path.extname(file.name) || ".csv";
    const filename = `${id}${ext}`;
    const dir = path.join(DATA_DIR, "tune-logs", params.id);
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, filename);
    const buf = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(dest, buf);

    const record = await prisma.tuneLog.create({
      data: {
        id,
        vehicleId: params.id,
        name: name || file.name.replace(/\.[^.]+$/, ""),
        filename,
        originalName: file.name,
        size: file.size,
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
