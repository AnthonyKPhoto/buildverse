import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/current-user";
import { sendMail } from "@/lib/mailer";


const testSchema = z.object({ to: z.string().email() });

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req, true);
  if (denied) return denied;

  try {
    const { to } = testSchema.parse(await req.json());
    const result = await sendMail({
      to,
      subject: "Upshift Garage SMTP test",
      text: "If you're reading this, Upshift Garage's SMTP settings are working.",
      html: "<p>If you're reading this, Upshift Garage's SMTP settings are working.</p>",
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || "Invalid email address" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to send test email" }, { status: 500 });
  }
}
