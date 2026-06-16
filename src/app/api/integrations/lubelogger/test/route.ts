import { NextRequest, NextResponse } from "next/server";
import { loadConfig, llFetch, normaliseUrl, LubeLoggerConfig } from "@/lib/lubelogger";

async function runTest(cfg: LubeLoggerConfig) {
  if (!cfg.url) return NextResponse.json({ error: "No URL configured" }, { status: 400 });
  try {
    const res = await llFetch(cfg, "/api/vehicles");
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `LubeLogger returned ${res.status}`, detail: text.slice(0, 200) },
        { status: 502 }
      );
    }
    const vehicles = await res.json();
    return NextResponse.json({
      ok: true,
      url: normaliseUrl(cfg.url),
      vehicleCount: Array.isArray(vehicles) ? vehicles.length : 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

// GET: test using config saved in DB
export async function GET() {
  const cfg = await loadConfig();
  return runTest(cfg);
}

// POST: test using values sent directly from the form (no DB save needed first).
// Placeholder "••••••••" credentials are automatically replaced from DB.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const stored = await loadConfig();

  const cfg: LubeLoggerConfig = {
    ...stored,
    url:      body.url      ?? stored.url,
    authType: body.authType ?? stored.authType,
    username: body.username ?? stored.username,
    apiKey:   (body.apiKey   && body.apiKey   !== "••••••••") ? body.apiKey   : stored.apiKey,
    password: (body.password && body.password !== "••••••••") ? body.password : stored.password,
  };

  return runTest(cfg);
}
