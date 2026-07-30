import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Accepts https:// URLs or base64 data: images uploaded from the client
const safeUrl = z
  .string()
  .max(10_000_000)
  .refine(
    (u) => /^https?:\/\//i.test(u) || /^data:image\//i.test(u),
    "Only http/https URLs or data:image/ strings are allowed"
  );

// Nullable + optional on every field that's nullable in the Prisma schema —
// a GET-then-POST round trip (JSON export/import) gets `null` back for unset
// fields, not `undefined`, and .optional() alone rejects null.
const modSchema = z.object({
  name:           z.string().min(1).max(255),
  category:       z.string().min(1).max(100),
  vendor:         z.string().max(255).nullable().optional(),
  brand:          z.string().max(255).nullable().optional(),
  price:          z.number().min(0).nullable().optional(),
  actualPrice:    z.number().min(0).nullable().optional(),
  notes:          z.string().max(2000).nullable().optional(),
  priority:       z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("NONE"),
  status:         z.enum(["PLANNED", "RESEARCHING", "ORDERED", "PURCHASED", "INSTALLED", "REMOVED"]).default("PLANNED"),
  link:           safeUrl.optional().nullable(),
  imageUrl:       safeUrl.optional().nullable(),
  difficulty:     z.string().max(50).nullable().optional(),
  installDate:    z.string().nullable().optional(),
  installMileage: z.number().int().min(0).nullable().optional(),
  laborCost:      z.number().min(0).nullable().optional(),
  diyInstall:     z.boolean().optional(), // non-nullable in Prisma (@default(false))
  partNumber:     z.string().max(100).nullable().optional(),
  orderNumber:    z.string().max(100).nullable().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const modifications = await prisma.modification.findMany({
      where: { vehicleId: params.id },
      orderBy: [{ category: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(modifications);
  } catch {
    return NextResponse.json({ error: "Failed to fetch modifications" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const data = modSchema.parse(body);
    const mod = await prisma.modification.create({
      data: {
        ...data,
        vehicleId: params.id,
        installDate: data.installDate ? new Date(data.installDate) : undefined,
      },
    });
    return NextResponse.json(mod, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create modification" }, { status: 500 });
  }
}
