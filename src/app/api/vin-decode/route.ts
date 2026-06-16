import { NextRequest, NextResponse } from "next/server";

const NHTSA = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended";

export async function GET(req: NextRequest) {
  const vin = req.nextUrl.searchParams.get("vin")?.trim().toUpperCase();
  if (!vin || vin.length !== 17) {
    return NextResponse.json({ error: "VIN must be 17 characters" }, { status: 400 });
  }

  try {
    const res = await fetch(`${NHTSA}/${vin}?format=json`, {
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) throw new Error(`NHTSA returned ${res.status}`);
    const data = await res.json();
    const r = data?.Results?.[0];
    if (!r || r.ErrorCode === "0" === false && !r.Make) {
      return NextResponse.json({ error: "VIN not found" }, { status: 404 });
    }

    const year = parseInt(r.ModelYear);
    const make = r.Make ? titleCase(r.Make) : "";
    const model = r.Model ?? "";
    const trim = r.Trim ?? "";
    const engineCc = r.DisplacementCC ? `${(parseFloat(r.DisplacementCC) / 1000).toFixed(1)}L` : "";
    const engineCyl = r.EngineCylinders ? `${r.EngineCylinders}-cyl` : "";
    const engineModel = r.EngineModel ?? "";
    const engine = [engineCc, engineCyl, engineModel].filter(Boolean).join(" ").trim();
    const transmission = r.TransmissionStyle ?? "";
    const drivetrain = normalizeDrivetrain(r.DriveType ?? "");

    return NextResponse.json({
      year: isNaN(year) ? null : year,
      make,
      model,
      trim,
      engine,
      transmission,
      drivetrain,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeDrivetrain(s: string): string {
  const u = s.toUpperCase();
  if (u.includes("AWD") || u.includes("ALL WHEEL")) return "AWD";
  if (u.includes("4WD") || u.includes("4X4") || u.includes("FOUR")) return "4WD";
  if (u.includes("FWD") || u.includes("FRONT")) return "FWD";
  if (u.includes("RWD") || u.includes("REAR")) return "RWD";
  return s;
}
