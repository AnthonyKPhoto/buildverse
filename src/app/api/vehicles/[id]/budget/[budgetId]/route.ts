import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  planned: z.number().min(0).max(100_000_000).optional(),
  actual:  z.number().min(0).max(100_000_000).optional(),
  notes:   z.string().max(2000).optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { budgetId: string } }) {
  try {
    const body = await req.json();
    const data = updateSchema.parse(body);
    const budget = await prisma.budget.update({ where: { id: params.budgetId }, data });
    return NextResponse.json(budget);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update budget" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { budgetId: string } }) {
  try {
    await prisma.budget.delete({ where: { id: params.budgetId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete budget item" }, { status: 500 });
  }
}
