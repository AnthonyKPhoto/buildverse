import { NextResponse } from "next/server";
import { loadConfig, saveConfig, llFetch, mapRecord, LL_RECORD_TYPES, LLRecord, LLRecordType } from "@/lib/lubelogger";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const cfg = await loadConfig();

  if (!cfg.url) return NextResponse.json({ error: "LubeLogger not configured" }, { status: 400 });

  const vehicleMap = cfg.vehicleMap; // { llVehicleId: bvVehicleId }
  const entries = Object.entries(vehicleMap);

  if (entries.length === 0) {
    return NextResponse.json({ error: "No vehicles mapped — configure vehicle mapping first" }, { status: 400 });
  }

  const types = LL_RECORD_TYPES.filter((t) => cfg.importTypes.includes(t.key));
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const [llIdStr, bvVehicleId] of entries) {
    const llVehicleId = parseInt(llIdStr);

    for (const recordType of types) {
      try {
        const res = await llFetch(cfg, `/api/vehicles/${llVehicleId}${recordType.path}`);
        if (!res.ok) { errors++; continue; }

        const records: LLRecord[] = await res.json();
        if (!Array.isArray(records)) continue;

        for (const rec of records) {
          const externalId = `ll:${llVehicleId}:${recordType.key}:${rec.id}`;

          // Skip if already imported
          const exists = await prisma.maintenanceLog.findFirst({
            where: { externalId },
            select: { id: true },
          });
          if (exists) { skipped++; continue; }

          const data = mapRecord(rec, recordType.key as LLRecordType, llVehicleId, bvVehicleId);
          await prisma.maintenanceLog.create({ data });
          imported++;
        }
      } catch {
        errors++;
      }
    }
  }

  await saveConfig({ lastSync: new Date().toISOString() });

  return NextResponse.json({ imported, skipped, errors, syncedAt: new Date().toISOString() });
}
