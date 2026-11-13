import { NextRequest, NextResponse } from "next/server";
import { loadConfig, saveConfig } from "@/lib/lubelogger";
import { requireAdmin } from "@/lib/auth/current-user";

// See src/app/api/health/route.ts for why this matters.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req, true);
  if (denied) return denied;
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
  const denied = await requireAdmin(req, true);
  if (denied) return denied;
  try {
    const body = await req.json();
    // If client sends the masked placeholder, don't overwrite the real value
    const ALLOWED = ["url", "authType", "apiKey", "username", "password", "vehicleMap", "importTypes", "syncInterval"];
    const patch: Record<string, unknown> = {};
    for (const k of ALLOWED) if (k in (body ?? {})) patch[k] = body[k];
    if (patch.apiKey   === "••••••••") delete patch.apiKey;
    if (patch.password === "••••••••") delete patch.password;
    const updated = await saveConfig(patch);
    return NextResponse.json({ ok: true, syncInterval: updated.syncInterval, lastSync: updated.lastSync });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
