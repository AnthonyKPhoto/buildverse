import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SAMPLE_CRITERIA = {
  OR: [
    { name: "Example S2000" },
    { AND: [{ make: "Honda" }, { model: "S2000" }, { name: { startsWith: "Example" } }] },
  ],
};

export async function GET() {
  // Collect sample vehicle IDs so we can exclude their activity
  const sampleIds = await prisma.vehicle
    .findMany({ where: SAMPLE_CRITERIA, select: { id: true } })
    .then((vs) => vs.map((v) => v.id));

  const notSample = sampleIds.length > 0
    ? { vehicleId: { notIn: sampleIds } }
    : {};

  const [mods, maintenance, files, alerts] = await Promise.all([
    prisma.modification.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      where: notSample,
      select: {
        id: true, name: true, status: true, vehicleId: true, createdAt: true,
        vehicle: { select: { id: true, name: true, year: true, make: true, model: true } },
      },
    }),
    prisma.maintenanceLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      where: notSample,
      select: {
        id: true, service: true, vehicleId: true, createdAt: true,
        vehicle: { select: { id: true, name: true, year: true, make: true, model: true } },
      },
    }),
    prisma.vehicleFile.findMany({
      take: 5,
      orderBy: { uploadedAt: "desc" },
      where: notSample,
      select: {
        id: true, originalName: true, vehicleId: true, uploadedAt: true,
        vehicle: { select: { id: true, name: true, year: true, make: true, model: true } },
      },
    }),
    prisma.trackedProduct.findMany({
      where: { alertThreshold: { not: null }, currentPrice: { not: null } },
      select: { id: true, title: true, currentPrice: true, alertThreshold: true, updatedAt: true },
    }),
  ]);

  function vLabel(v: { name?: string | null; year: number; make: string; model: string }) {
    return v.name || `${v.year} ${v.make} ${v.model}`;
  }

  const items = [
    ...mods.map((m) => ({
      type: "mod" as const,
      id: `mod_${m.id}`,
      text: m.name,
      sub: vLabel(m.vehicle),
      vehicleId: m.vehicleId,
      createdAt: m.createdAt.toISOString(),
    })),
    ...maintenance.map((l) => ({
      type: "service" as const,
      id: `svc_${l.id}`,
      text: l.service,
      sub: vLabel(l.vehicle),
      vehicleId: l.vehicleId,
      createdAt: l.createdAt.toISOString(),
    })),
    ...files.map((f) => ({
      type: "file" as const,
      id: `file_${f.id}`,
      text: f.originalName,
      sub: vLabel(f.vehicle),
      vehicleId: f.vehicleId,
      createdAt: f.uploadedAt.toISOString(),
    })),
    ...alerts
      .filter((p) => p.currentPrice != null && p.alertThreshold != null && p.currentPrice <= p.alertThreshold!)
      .map((p) => ({
        type: "alert" as const,
        id: `alert_${p.id}`,
        text: p.title,
        sub: `Now $${p.currentPrice!.toFixed(2)} · target $${p.alertThreshold!.toFixed(2)}`,
        vehicleId: null,
        createdAt: p.updatedAt.toISOString(),
      })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 15);

  return NextResponse.json(items);
}
