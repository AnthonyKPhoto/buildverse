import { NextRequest, NextResponse } from "next/server";
import { tokenPickupStore } from "@/lib/oauth-store";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

  const token = tokenPickupStore.get(key);
  if (!token) return NextResponse.json({ error: "not_found" }, { status: 404 });

  tokenPickupStore.delete(key);
  return NextResponse.json(token);
}
