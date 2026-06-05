import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const budgetSchema = z.object({
  category: z.string().min(1).max(100),
  planned:  z.number().min(0).max(100_000_000),
  actual:   z.number().min(0).max(100_000_000).optional(),
  notes:    z.string().max(2000).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const budgets = await prisma.budget.findMany({
      where: { vehicleId: params.id },
      orderBy: { category: "asc" },
    });
    return NextResponse.json(budgets);
  } catch {
    return NextResponse.json({ error: "Failed to fetch budgets" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const data = budgetSchema.parse(body);
    const budget = await prisma.budget.upsert({
      where: { vehicleId_category: { vehicleId: params.id, category: data.category } },
      update: { planned: data.planned, actual: data.actual ?? 0, notes: data.notes },
      create: { vehicleId: params.id, ...data },
    });
    return NextResponse.json(budget);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to save budget" }, { status: 500 });
  }
}
