import { NextRequest, NextResponse } from "next/server";
import { loadConfig, saveConfig } from "@/lib/lubelogger";

// See src/app/api/health/route.ts for why this matters.
export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = await loadConfig();
  // Mask credentials in response — client never needs the raw secrets back
  return NextResponse.json({
    ...cfg,
    apiKey:   cfg.apiKey   ? "••••••••" : "",
    password: cfg.password ? "••••••••" : "",
    hasApiKey:   !!cfg.apiKey,
    hasPassword: !!cfg.password,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // If client sends the masked placeholder, don't overwrite the real value
    const patch: Record<string, unknown> = { ...body };
    if (patch.apiKey   === "••••••••") delete patch.apiKey;
    if (patch.password === "••••••••") delete patch.password;
    const updated = await saveConfig(patch);
    return NextResponse.json({ ok: true, syncInterval: updated.syncInterval, lastSync: updated.lastSync });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
