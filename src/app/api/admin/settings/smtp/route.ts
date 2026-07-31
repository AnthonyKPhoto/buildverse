import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSmtpConfigMasked, saveSmtpConfig } from "@/lib/mailer";

// See src/app/api/health/route.ts for why this matters — without it, GET
// routes with no dynamic-API usage can get statically cached at build time.
export const dynamic = "force-dynamic";

function requireAdmin(req: NextRequest): NextResponse | null {
  if (req.headers.get("x-user-role") !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const config = await getSmtpConfigMasked();
  return NextResponse.json(config);
}

const smtpSchema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.boolean(),
  username: z.string().min(1),
  from: z.string().min(1),
  // Omit to keep the currently-stored password; pass "" to clear it.
  password: z.string().optional(),
});

export async function PUT(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const data = smtpSchema.parse(body);
    await saveSmtpConfig(data);
    const config = await getSmtpConfigMasked();
    return NextResponse.json(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || "Invalid input" }, { status: 400 });
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[PUT /api/admin/settings/smtp]", msg);
    return NextResponse.json({ error: "Failed to save SMTP settings" }, { status: 500 });
  }
}
