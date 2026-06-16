import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";

const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg":   "jpg",
  "image/png":    "png",
  "image/gif":    "gif",
  "image/webp":   "webp",
  "image/avif":   "avif",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain":   "txt",
};

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

function filesRoot(): string {
  return process.env.BUILDVERSE_DATA_DIR
    ? path.join(process.env.BUILDVERSE_DATA_DIR, "vehicle-files")
    : path.join(process.cwd(), "data", "vehicle-files");
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const files = await prisma.vehicleFile.findMany({
    where: { vehicleId: params.id },
    orderBy: { uploadedAt: "desc" },
  });
  return NextResponse.json(files);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 50 MB)" }, { status: 413 });

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME[mime]) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 415 });
  }

  const id = uuidv4();
  const ext = ALLOWED_MIME[mime];
  const storedName = `${id}.${ext}`;
  const vehicleDir = path.join(filesRoot(), params.id);

  fs.mkdirSync(vehicleDir, { recursive: true });

  const bytes = await file.arrayBuffer();
  fs.writeFileSync(path.join(vehicleDir, storedName), Buffer.from(bytes));

  const record = await prisma.vehicleFile.create({
    data: {
      id,
      vehicleId: params.id,
      filename: storedName,
      originalName: file.name,
      mimeType: mime,
      size: file.size,
    },
  });

  return NextResponse.json(record, { status: 201 });
}
