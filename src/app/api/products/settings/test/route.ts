import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/current-user";
import { getPriceAlertSettings, sendTestAlert } from "@/lib/price-tracker";
import { createRateLimiter } from "@/lib/auth/rate-limit";

// Sends a sample alert so the user can confirm SMTP + recipients work.
// Rate-limited so it can't be used to spam an inbox.
const limiter = createRateLimiter(5, 10 * 60 * 1000);

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req, true);
  if (denied) return denied;
  if (limiter.isLimited("test")) {
    return NextResponse.json({ error: "Too many test emails — wait a few minutes" }, { status: 429 });
  }
  limiter.record("test");

  const result = await sendTestAlert(await getPriceAlertSettings());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}
