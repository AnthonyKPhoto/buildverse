import { NextResponse } from "next/server";
import { getRemovedLog, clearRemovedLog } from "@/lib/price-tracker";

export const dynamic = "force-dynamic";

/** GET → products the scheduled check auto-removed (their mod was bought / installed / removed). */
export async function GET() {
  return NextResponse.json(await getRemovedLog());
}

/** DELETE → dismiss that list. */
export async function DELETE() {
  await clearRemovedLog();
  return NextResponse.json({ ok: true });
}
