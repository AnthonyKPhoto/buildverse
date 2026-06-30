"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Car, Plus, Wrench, Edit2, Trash2, TrendingUp, DollarSign, Zap, ArrowRight } from "lucide-react";
import { AddVehicleDialog } from "@/components/vehicles/AddVehicleDialog";
import { formatCurrency, calcBuildCompletion } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Vehicle {
  id: string;
  name?: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  platform?: string;
  engine?: string;
  transmission?: string;
  drivetrain?: string;
  color?: string;
  photoUrl?: string;
  mileage?: number;
  modifications: { id: string; status: string; price?: number | null }[];
  _count: { modifications: number; maintenanceLogs: number };
}

function VehicleCard({ vehicle, onEdit, onDelete }: { vehicle: Vehicle; onEdit: () => void; onDelete: () => void }) {
  const [imgErr, setImgErr] = useState(false);
  const completion = calcBuildCompletion(vehicle.modifications);
  const installedMods = vehicle.modifications.filter((m) => m.status === "INSTALLED");
  const installedValue = installedMods.reduce((s, m) => s + (m.price ?? 0), 0);
  const plannedValue = vehicle.modifications
    .filter((m) => m.status !== "INSTALLED")
    .reduce((s, m) => s + (m.price ?? 0), 0);

  return (
    <Link href={`/garage/${vehicle.id}`} className="block">
      <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card hover:border-theme/30 transition-all duration-200 cursor-pointer">
        {/* Photo area */}
        <div className="relative h-48 bg-secondary overflow-hidden">
          {vehicle.photoUrl && !imgErr ? (
            vehicle.photoUrl.startsWith("data:") ? (
              <img
                src={vehicle.photoUrl}
                alt={vehicle.name || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                onError={() => setImgErr(true)}
              />
            ) : (
              <Image
                src={vehicle.photoUrl}
                alt={vehicle.name || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                onError={() => setImgErr(true)}
              />
            )
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Car className="w-16 h-16 text-muted-foreground/15" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent" />

          {/* Action buttons */}
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm" variant="secondary"
              className="h-7 w-7 p-0 bg-card/90 hover:bg-card"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }}
            >
              <Edit2 className="w-3 h-3" />
            </Button>
            <Button
              size="sm" variant="secondary"
              className="h-7 w-7 p-0 bg-card/90 hover:bg-destructive hover:text-destructive-foreground"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>

          {vehicle.color && (
            <div className="absolute bottom-2 left-2">
              <Badge variant="secondary" className="text-xs bg-card/90">{vehicle.color}</Badge>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="mb-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-base leading-tight">
                  {vehicle.name || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                </h3>
                {vehicle.name && (
                  <p className="text-sm text-muted-foreground">{vehicle.year} {vehicle.make} {vehicle.model}</p>
                )}
              </div>
              {vehicle.trim && <Badge variant="outline" className="text-xs shrink-0">{vehicle.trim}</Badge>}
            </div>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {vehicle.platform && <span className="text-xs text-theme font-medium">{vehicle.platform}</span>}
              {vehicle.engine && <span className="text-xs text-muted-foreground">{vehicle.engine}</span>}
              {vehicle.drivetrain && <span className="text-xs text-muted-foreground">{vehicle.drivetrain}</span>}
            </div>
            {vehicle.mileage != null && (
              <p className="text-xs text-muted-foreground mt-1">{vehicle.mileage.toLocaleString()} mi</p>
            )}
          </div>

          <div className="space-y-1 mb-4">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Build progress</span>
              <span className="font-semibold">{completion}%</span>
            </div>
            <Progress value={completion} className="h-1.5" />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center pt-3 border-t border-border/60 mb-4">
            <div>
              <p className="text-xs text-muted-foreground">Mods</p>
              <p className="text-sm font-bold">{vehicle._count.modifications}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Installed</p>
              <p className="text-sm font-bold text-green-400">{formatCurrency(installedValue)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Planned</p>
              <p className="text-sm font-bold text-theme">{formatCurrency(plannedValue)}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-theme text-sm font-medium group-hover:gap-3 transition-all duration-200">
            View build <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function GaragePage() {
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);

  const load = () =>
    fetch("/api/vehicles")
      .then((r) => r.json())
      .then((d) => { setVehicles(Array.isArray(d) ? d : []); setLoading(false); });

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this vehicle and all its modifications? This cannot be undone.")) return;
    const res = await fetch(`/api/vehicles/${id}`, { method: "DELETE" });
    if (res.ok) {
      setVehicles((v) => v.filter((x) => x.id !== id));
      toast({ title: "Vehicle removed from garage" });
    } else {
      toast({ title: "Failed to delete vehicle", variant: "destructive" });
    }
  };

  const handleSaved = () => { setAddOpen(false); setEditVehicle(null); load(); };

  const totalMods = vehicles.reduce((s, v) => s + v._count.modifications, 0);
  const totalInstalled = vehicles.reduce(
    (s, v) => s + v.modifications.filter(m => m.status === "INSTALLED").reduce((ms, m) => ms + (m.price ?? 0), 0), 0
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-muted-foreground text-sm">
          <div className="w-4 h-4 border-2 border-theme border-t-transparent rounded-full animate-spin" />
          Loading garage…
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Hero banner */}
      <div className="-mx-6 -mt-8 mb-8 px-6 pt-8 pb-6 border-b border-border/60 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-theme/5 pointer-events-none" />
        <div className="absolute top-0 right-0 w-72 h-36 bg-theme/8 rounded-full blur-3xl -translate-y-8 translate-x-8 pointer-events-none" />
        <div className="relative">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs font-medium text-muted-foreground/60 tracking-wider uppercase mb-1">Garage</p>
              <h1 className="text-3xl font-bold tracking-tight">My Builds</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {vehicles.length === 0
                  ? "No vehicles yet — add your first build"
                  : `${vehicles.length} vehicle${vehicles.length !== 1 ? "s" : ""} · ${totalMods} mod${totalMods !== 1 ? "s" : ""} tracked`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {vehicles.length >= 2 && (
                <Link href="/garage/compare">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <TrendingUp className="w-4 h-4" /> Compare
                  </Button>
                </Link>
              )}
              <Button size="sm" className="gap-2 bg-theme hover:brightness-90" onClick={() => setAddOpen(true)}>
                <Plus className="w-4 h-4" /> Add Vehicle
              </Button>
            </div>
          </div>

          {/* Stats row */}
          {vehicles.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Vehicles",  value: vehicles.length.toString(),       icon: Car,        color: "text-theme",     bg: "bg-theme/10" },
                { label: "Total Mods", value: totalMods.toString(),            icon: Wrench,     color: "text-blue-400",  bg: "bg-blue-500/10" },
                { label: "Invested",  value: formatCurrency(totalInstalled),   icon: DollarSign, color: "text-amber-400", bg: "bg-amber-500/10" },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className="flex items-center gap-3 bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl px-4 py-3">
                  <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <div>
                    <p className="text-xl font-bold leading-none">{value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Empty state */}
      {vehicles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-2xl bg-theme/10 ring-1 ring-theme/20 flex items-center justify-center mb-5">
            <Zap className="w-10 h-10 text-theme" />
          </div>
          <h2 className="text-xl font-bold mb-2">Your garage is empty</h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Add your first vehicle to start planning and tracking modifications.
          </p>
          <Button className="bg-theme hover:brightness-90 gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4" /> Add First Vehicle
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {vehicles.map((v) => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              onEdit={() => setEditVehicle(v)}
              onDelete={() => handleDelete(v.id)}
            />
          ))}
        </div>
      )}

      <AddVehicleDialog
        open={addOpen || !!editVehicle}
        onOpenChange={(o) => { if (!o) { setAddOpen(false); setEditVehicle(null); } }}
        onCreated={handleSaved}
        editVehicle={editVehicle}
      />
    </div>
  );
}
