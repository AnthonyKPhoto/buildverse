import { NextResponse } from "next/server";
import { loadConfig, llFetch, normaliseUrl } from "@/lib/lubelogger";

export async function GET() {
  const cfg = await loadConfig();
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
