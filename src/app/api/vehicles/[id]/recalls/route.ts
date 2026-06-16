import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const NHTSA = "https://api.nhtsa.gov/recalls/recallsByVehicle";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: params.id },
    select: { make: true, model: true, year: true },
  });
  if (!vehicle) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });

  const url = `${NHTSA}?make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}&modelYear=${vehicle.year}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`NHTSA returned ${res.status}`);
    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];
    return NextResponse.json({
      count: data.Count ?? results.length,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      recalls: results.map((r: Record<string, string>) => ({
        campaignNumber: r.NHTSACampaignNumber,
        component: r.Component,
        summary: r.Summary,
        consequence: r.Consequence,
        remedy: r.Remedy,
        reportDate: r.ReportReceivedDate,
        nhtsaUrl: `https://www.nhtsa.gov/vehicle-safety/recalls?nhtsaId=${r.NHTSACampaignNumber}`,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
