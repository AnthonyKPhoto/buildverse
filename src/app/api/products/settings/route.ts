import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, getVerifiedUser } from "@/lib/auth/current-user";
import { isAuthEnabled } from "@/lib/auth/password";
import { isSmtpConfigured } from "@/lib/mailer";
import { getPriceAlertSettings, savePriceAlertSettings, resolveRecipients } from "@/lib/price-tracker";

export const dynamic = "force-dynamic";

// GET: everyone can see whether alerts are on (the tracker page shows hints),
// but the recipient list is only returned to admins (or in local mode).
export async function GET(req: NextRequest) {
  const settings = await getPriceAlertSettings();
  const smtpConfigured = await isSmtpConfigured();
  let isAdmin = !isAuthEnabled();
  if (!isAdmin) isAdmin = (await getVerifiedUser(req))?.role === "admin";

  return NextResponse.json({
    ...settings,
    recipients: isAdmin ? settings.recipients : [],
    effectiveRecipientCount: (await resolveRecipients(settings)).length,
    smtpConfigured,
    canEdit: isAdmin,
  });
}

const schema = z.object({
  emailEnabled: z.boolean().optional(),
  recipients: z.array(z.string().max(254)).max(10).optional(),
  autoCheck: z.boolean().optional(),
  intervalHours: z.number().min(1).max(168).optional(),
  dropPercent: z.number().min(0).max(90).optional(),
});

export async function PUT(req: NextRequest) {
  const denied = await requireAdmin(req, true);
  if (denied) return denied;
  try {
    const body = schema.parse(await req.json());
    const saved = await savePriceAlertSettings(body);
    return NextResponse.json({ ...saved, smtpConfigured: await isSmtpConfigured(), effectiveRecipientCount: (await resolveRecipients(saved)).length, canEdit: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
