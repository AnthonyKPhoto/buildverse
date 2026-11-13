import { NextRequest, NextResponse } from "next/server";
import { refreshProduct } from "@/lib/price-tracker";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const updated = await refreshProduct(params.id);
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to refresh product" }, { status: 500 });
  }
}
