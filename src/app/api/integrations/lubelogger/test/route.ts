import { NextRequest, NextResponse } from "next/server";
import { loadConfig, llFetch, normaliseUrl, LubeLoggerConfig } from "@/lib/lubelogger";

async function runTest(cfg: LubeLoggerConfig) {
  if (!cfg.url) return NextResponse.json({ error: "No URL configured" }, { status: 400 });
  try {
    const res = await llFetch(cfg, "/api/vehicles");
    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok) {
      if (contentType.includes("text/html")) {
        return NextResponse.json(
          { error: `Reverse proxy returned ${res.status} with an HTML page — Authelia/nginx is blocking the request. Use API Key auth and configure your proxy to forward the Authorization header.` },
          { status: 502 }
        );
      }
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `LubeLogger returned ${res.status}`, detail: text.slice(0, 200) },
        { status: 502 }
      );
    }
    if (contentType.includes("text/html")) {
      return NextResponse.json(
        { error: "Your reverse proxy (Authelia/nginx) is blocking the request and returning its own login page. Switch to API Key auth and configure your proxy to forward the Authorization header to LubeLogger." },
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
    const friendly = msg.includes("fetch") || msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")
      ? `Cannot reach ${normaliseUrl(cfg.url)} — check the URL and that LubeLogger is running`
      : msg;
    return NextResponse.json({ error: friendly }, { status: 502 });
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
