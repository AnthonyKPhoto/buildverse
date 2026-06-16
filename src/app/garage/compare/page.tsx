"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Car, TrendingUp } from "lucide-react";
import { formatCurrency, calcBuildCompletion, calcTotalModValue } from "@/lib/utils";

interface VehicleSummary {
  id: string;
  name?: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  photoUrl?: string;
  modifications: { id: string; status: string; price?: number | null; actualPrice?: number | null; category: string }[];
}

function vehicleLabel(v: VehicleSummary) {
  return `${v.year} ${v.make} ${v.model}${v.trim ? " " + v.trim : ""}${v.name ? ` (${v.name})` : ""}`;
}

function VehicleHeader({ v }: { v: VehicleSummary }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-12 h-12 rounded-xl overflow-hidden bg-secondary shrink-0 border border-border">
        {v.photoUrl ? (
          <Image src={v.photoUrl} alt={v.make} width={48} height={48} className="object-cover w-full h-full" unoptimized />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Car className="w-6 h-6 text-muted-foreground/40" />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="font-bold text-sm truncate">{v.year} {v.make} {v.model}</p>
        {v.trim && <p className="text-xs text-muted-foreground">{v.trim}</p>}
        {v.name && <p className="text-xs text-theme">{v.name}</p>}
      </div>
    </div>
  );
}

export default function ComparePage() {
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [aId, setAId] = useState<string>("");
  const [bId, setBId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/vehicles")
      .then((r) => r.json())
      .then((d) => {
        setVehicles(Array.isArray(d) ? d : []);
        if (d.length >= 2) { setAId(d[0].id); setBId(d[1].id); }
        else if (d.length === 1) { setAId(d[0].id); }
      })
      .finally(() => setLoading(false));
  }, []);

  const vehicleA = vehicles.find((v) => v.id === aId);
  const vehicleB = vehicles.find((v) => v.id === bId);

  function stats(v?: VehicleSummary) {
    if (!v) return null;
    const mods         = v.modifications;
    const installed    = mods.filter((m) => m.status === "INSTALLED");
    const completion   = calcBuildCompletion(mods as Parameters<typeof calcBuildCompletion>[0]);
    const { installed: installedVal, planned: plannedVal } = calcTotalModValue(mods as Parameters<typeof calcTotalModValue>[0]);

    const catCounts = mods.reduce<Record<string, number>>((acc, m) => {
      acc[m.category] = (acc[m.category] ?? 0) + 1;
      return acc;
    }, {});
    const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];

    return { mods: mods.length, installed: installed.length, completion, installedVal, plannedVal, topCat };
  }

  const sa = stats(vehicleA);
  const sb = stats(vehicleB);

  function winner(aVal: number, bVal: number, higherIsBetter = true): { a: boolean; b: boolean } {
    if (aVal === bVal) return { a: false, b: false };
    return higherIsBetter
      ? { a: aVal > bVal, b: bVal > aVal }
      : { a: aVal < bVal, b: bVal < aVal };
  }

  const rows: { label: string; a: string; b: string; numA?: number; numB?: number; higherBetter?: boolean }[] = sa && sb ? [
    { label: "Total Mods",        a: String(sa.mods),          b: String(sb.mods),          numA: sa.mods,          numB: sb.mods,          higherBetter: true  },
    { label: "Installed Mods",    a: String(sa.installed),     b: String(sb.installed),     numA: sa.installed,     numB: sb.installed,     higherBetter: true  },
    { label: "Build Completion",  a: `${sa.completion}%`,      b: `${sb.completion}%`,      numA: sa.completion,    numB: sb.completion,    higherBetter: true  },
    { label: "Installed Spend",   a: formatCurrency(sa.installedVal), b: formatCurrency(sb.installedVal), numA: sa.installedVal, numB: sb.installedVal, higherBetter: true },
    { label: "Planned Spend",     a: formatCurrency(sa.plannedVal),   b: formatCurrency(sb.plannedVal),   numA: sa.plannedVal,   numB: sb.plannedVal,   higherBetter: false },
    { label: "Top Category",      a: sa.topCat?.[0] ?? "—",   b: sb.topCat?.[0] ?? "—"   },
    { label: "Category Depth",    a: sa.topCat ? `${sa.topCat[1]} mods` : "—", b: sb.topCat ? `${sb.topCat[1]} mods` : "—" },
  ] : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
        <div className="w-5 h-5 border-2 border-theme border-t-transparent rounded-full animate-spin" />
        Loading…
      </div>
    );
  }

  if (vehicles.length < 2) {
    return (
      <div className="text-center py-20 space-y-3">
        <Car className="w-12 h-12 mx-auto text-muted-foreground/30" />
        <p className="text-muted-foreground">You need at least 2 vehicles to compare</p>
        <Link href="/garage"><Button variant="outline">Back to Garage</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back */}
      <div className="flex items-center gap-3">
        <Link href="/garage">
          <Button variant="ghost" size="sm" className="gap-2 -ml-2">
            <ArrowLeft className="w-4 h-4" />
            Garage
          </Button>
        </Link>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-theme" />
          Compare Builds
        </h1>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-widest">Vehicle A</p>
          <Select value={aId} onValueChange={setAId}>
            <SelectTrigger><SelectValue placeholder="Pick a vehicle" /></SelectTrigger>
            <SelectContent>
              {vehicles.filter((v) => v.id !== bId).map((v) => (
                <SelectItem key={v.id} value={v.id}>{vehicleLabel(v)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-widest">Vehicle B</p>
          <Select value={bId} onValueChange={setBId}>
            <SelectTrigger><SelectValue placeholder="Pick a vehicle" /></SelectTrigger>
            <SelectContent>
              {vehicles.filter((v) => v.id !== aId).map((v) => (
                <SelectItem key={v.id} value={v.id}>{vehicleLabel(v)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Comparison table */}
      {vehicleA && vehicleB && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Side-by-Side Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Vehicle headers */}
            <div className="grid grid-cols-[1fr_1fr_1fr] gap-4 mb-4 border-b border-border pb-4">
              <div />
              <VehicleHeader v={vehicleA} />
              <VehicleHeader v={vehicleB} />
            </div>

            {/* Rows */}
            <div className="space-y-0">
              {rows.map(({ label, a, b, numA, numB, higherBetter }) => {
                const w = (numA !== undefined && numB !== undefined)
                  ? winner(numA, numB, higherBetter)
                  : { a: false, b: false };
                return (
                  <div key={label} className="grid grid-cols-[1fr_1fr_1fr] gap-4 py-2.5 border-b border-border/40 last:border-0">
                    <span className="text-xs text-muted-foreground font-medium self-center">{label}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${w.a ? "text-theme" : ""}`}>{a}</span>
                      {w.a && <Badge className="text-2xs px-1.5 py-0 bg-theme/15 text-theme border-theme/20">Better</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${w.b ? "text-theme" : ""}`}>{b}</span>
                      {w.b && <Badge className="text-2xs px-1.5 py-0 bg-theme/15 text-theme border-theme/20">Better</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {(!vehicleA || !vehicleB) && (
        <p className="text-center text-muted-foreground text-sm py-8">Select two vehicles above to compare</p>
      )}
    </div>
  );
}
