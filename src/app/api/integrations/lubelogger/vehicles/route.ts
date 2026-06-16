import { NextResponse } from "next/server";
import { loadConfig, llFetch } from "@/lib/lubelogger";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const cfg = await loadConfig();
  if (!cfg.url) return NextResponse.json({ error: "Not configured" }, { status: 400 });

  try {
    const [llRes, bvVehicles] = await Promise.all([
      llFetch(cfg, "/api/vehicles"),
      prisma.vehicle.findMany({
        orderBy: [{ year: "desc" }, { make: "asc" }],
        select: { id: true, name: true, year: true, make: true, model: true },
      }),
    ]);

    if (!llRes.ok) {
      return NextResponse.json({ error: `LubeLogger returned ${llRes.status}` }, { status: 502 });
    }

    const llVehicles = await llRes.json();
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
