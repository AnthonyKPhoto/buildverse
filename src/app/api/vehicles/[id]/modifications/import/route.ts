import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

const rowSchema = z.object({
  name:     z.string().min(1).max(500),
  category: z.string().min(1).max(100),
  brand:    z.string().max(200).optional(),
  vendor:   z.string().max(200).optional(),
  price:    z.number().nullable().optional(),
  status:   z.string().optional(),
  priority: z.string().optional(),
  notes:    z.string().max(5000).optional(),
});

const VALID_STATUSES  = new Set(["PLANNED","RESEARCHING","ORDERED","PURCHASED","INSTALLED","REMOVED"]);
const VALID_PRIORITIES = new Set(["NONE","LOW","MEDIUM","HIGH","CRITICAL"]);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { rows } = await req.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "rows array required" }, { status: 400 });
  }
  if (rows.length > 500) {
    return NextResponse.json({ error: "Max 500 rows per import" }, { status: 400 });
  }

  const created: string[] = [];
  const errors: { row: number; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    try {
      const row = rowSchema.parse(rows[i]);
      const status   = VALID_STATUSES.has((row.status ?? "").toUpperCase())
        ? (row.status!).toUpperCase() : "PLANNED";
      const priority = VALID_PRIORITIES.has((row.priority ?? "").toUpperCase())
        ? (row.priority!).toUpperCase() : "NONE";

      const mod = await prisma.modification.create({
        data: {
          id: uuidv4(),
          vehicleId: params.id,
          name: row.name,
          category: row.category,
          brand: row.brand ?? null,
          vendor: row.vendor ?? null,
          price: row.price ?? null,
          notes: row.notes ?? null,
          status,
          priority,
          diyInstall: false,
        },
      });
      created.push(mod.id);
    } catch (err) {
      errors.push({ row: i + 1, error: err instanceof Error ? err.message : "Invalid row" });
    }
  }

  return NextResponse.json({ created: created.length, errors });
}
