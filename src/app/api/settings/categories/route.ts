import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MOD_CATEGORIES } from "@/lib/utils";

// See src/app/api/health/route.ts for why this matters.
export const dynamic = "force-dynamic";

const KEY = "custom_categories";

export async function GET() {
  const row = await prisma.setting.findUnique({ where: { key: KEY } }).catch(() => null);
  if (!row) return NextResponse.json({ categories: [...MOD_CATEGORIES], isCustom: false });
  try {
    const parsed = JSON.parse(row.value);
    return NextResponse.json({ categories: Array.isArray(parsed) ? parsed : [...MOD_CATEGORIES], isCustom: true });
  } catch {
    return NextResponse.json({ categories: [...MOD_CATEGORIES], isCustom: false });
  }
}

export async function PUT(req: NextRequest) {
  const { categories } = await req.json();
  if (!Array.isArray(categories)) {
    return NextResponse.json({ error: "categories must be an array" }, { status: 400 });
  }
  const clean = categories.map((c: unknown) => String(c).trim()).filter(Boolean);
  await prisma.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(clean) },
    update: { value: JSON.stringify(clean) },
  });
  return NextResponse.json({ categories: clean });
}

export async function DELETE() {
  await prisma.setting.delete({ where: { key: KEY } }).catch(() => {});
  return NextResponse.json({ categories: [...MOD_CATEGORIES], isCustom: false });
}
