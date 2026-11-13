import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/current-user";
import { runPriceCheck } from "@/lib/price-tracker";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// "Check everything now" — same code path as the background job, including
// the alert email digest. Admin-only since it can send email.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req, true);
  if (denied) return denied;
  const summary = await runPriceCheck({ force: true });
  return NextResponse.json(summary);
}
