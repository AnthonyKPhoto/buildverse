import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendMail } from "@/lib/mailer";

function requireAdmin(req: NextRequest): NextResponse | null {
  if (req.headers.get("x-user-role") !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  return null;
}

const testSchema = z.object({ to: z.string().email() });

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const { to } = testSchema.parse(await req.json());
    const result = await sendMail({
      to,
      subject: "BuildVerse SMTP test",
      text: "If you're reading this, BuildVerse's SMTP settings are working.",
      html: "<p>If you're reading this, BuildVerse's SMTP settings are working.</p>",
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
