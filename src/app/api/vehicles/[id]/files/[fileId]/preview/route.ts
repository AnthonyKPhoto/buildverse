import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import path from "path";
import fs from "fs";
import mammoth from "mammoth";

function filesRoot(): string {
  return process.env.BUILDVERSE_DATA_DIR
    ? path.join(process.env.BUILDVERSE_DATA_DIR, "vehicle-files")
    : path.join(process.cwd(), "data", "vehicle-files");
}

const DOCX_TYPES = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  const record = await prisma.vehicleFile.findFirst({
    where: { id: params.fileId, vehicleId: params.id },
  });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!DOCX_TYPES.has(record.mimeType)) {
    return NextResponse.json({ error: "Preview only supported for Word documents" }, { status: 415 });
  }

  const filePath = path.join(filesRoot(), params.id, record.filename);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File missing from disk" }, { status: 404 });
  }

  const result = await mammoth.convertToHtml({ path: filePath });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px 32px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.7;
      color: #e2e8f0;
      background: #0f1117;
    }
    h1, h2, h3, h4, h5, h6 {
      color: #f8fafc;
      margin: 1.25em 0 0.5em;
      line-height: 1.3;
      font-weight: 600;
    }
    h1 { font-size: 1.75em; }
    h2 { font-size: 1.4em; }
    h3 { font-size: 1.15em; }
    p { margin: 0.5em 0; }
    a { color: #60a5fa; }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
    }
    th, td {
      border: 1px solid #334155;
      padding: 6px 10px;
      text-align: left;
    }
    th { background: #1e293b; font-weight: 600; }
    ul, ol { padding-left: 1.5em; margin: 0.5em 0; }
    li { margin: 0.2em 0; }
    img { max-width: 100%; height: auto; }
    strong, b { color: #f1f5f9; }
    em, i { color: #cbd5e1; }
    blockquote {
      border-left: 3px solid #334155;
      margin: 0.75em 0;
      padding: 0.5em 1em;
      color: #94a3b8;
    }
    hr { border: none; border-top: 1px solid #1e293b; margin: 1.5em 0; }
    pre, code {
      background: #1e293b;
      border-radius: 4px;
      padding: 0.2em 0.4em;
      font-family: "Consolas", "Courier New", monospace;
      font-size: 0.9em;
    }
    pre { padding: 1em; overflow-x: auto; }
  </style>
</head>
<body>${result.value}</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
