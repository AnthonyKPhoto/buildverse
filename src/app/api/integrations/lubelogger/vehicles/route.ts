import { NextRequest, NextResponse } from "next/server";
import { loadConfig, llFetch, LubeLoggerConfig } from "@/lib/lubelogger";
import { prisma } from "@/lib/prisma";

// See src/app/api/health/route.ts for why this matters.
export const dynamic = "force-dynamic";

async function fetchLLAndBVVehicles(cfg: LubeLoggerConfig) {
  const [llRes, bvVehicles] = await Promise.all([
    llFetch(cfg, "/api/vehicles"),
    prisma.vehicle.findMany({
      orderBy: [{ year: "desc" }, { make: "asc" }],
      select: { id: true, name: true, year: true, make: true, model: true },
    }),
  ]);

  if (!llRes.ok) {
    throw new Error(`LubeLogger returned ${llRes.status}`);
  }

  const llVehicles = await llRes.json();
  return { llVehicles, bvVehicles };
}

// GET — reads auth config from DB
export async function GET() {
  const cfg = await loadConfig();
  if (!cfg.url) return NextResponse.json({ error: "Not configured" }, { status: 400 });

  try {
    const { llVehicles, bvVehicles } = await fetchLLAndBVVehicles(cfg);
    return NextResponse.json({
      lubelogger: Array.isArray(llVehicles) ? llVehicles : [],
      buildverse: bvVehicles,
      vehicleMap: cfg.vehicleMap,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

// POST — accepts live credentials in body so vehicle mapping shows even before DB save succeeds.
// vehicleMap is always read from DB (preserves any previously saved mapping).
export async function POST(req: NextRequest) {
  let liveCreds: { url?: string; authType?: string; apiKey?: string; username?: string; password?: string } = {};
  try { liveCreds = await req.json(); } catch {}

  const dbCfg = await loadConfig();

  const cfg: LubeLoggerConfig = {
    ...dbCfg,
    ...(liveCreds.url ? { url: liveCreds.url } : {}),
    ...(liveCreds.authType ? { authType: liveCreds.authType as LubeLoggerConfig["authType"] } : {}),
    // Use live key only if it's not the masked placeholder
    ...(liveCreds.apiKey && liveCreds.apiKey !== "••••••••" ? { apiKey: liveCreds.apiKey } : {}),
    ...(liveCreds.username ? { username: liveCreds.username } : {}),
    ...(liveCreds.password && liveCreds.password !== "••••••••" ? { password: liveCreds.password } : {}),
  };

  if (!cfg.url) return NextResponse.json({ error: "Not configured" }, { status: 400 });

  try {
    const { llVehicles, bvVehicles } = await fetchLLAndBVVehicles(cfg);
    return NextResponse.json({
      lubelogger: Array.isArray(llVehicles) ? llVehicles : [],
      buildverse: bvVehicles,
      vehicleMap: dbCfg.vehicleMap, // always from DB
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
