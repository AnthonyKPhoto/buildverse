"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Car, Plus, Wrench, Edit2, Trash2 } from "lucide-react";
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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Garage</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {vehicles.length === 0 ? "No vehicles yet" : `${vehicles.length} vehicle${vehicles.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Vehicle
        </Button>
      </div>

      {vehicles.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center mb-4">
              <Car className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold mb-1.5">Your garage is empty</h3>
            <p className="text-muted-foreground text-sm max-w-xs mb-5">
              Add your first vehicle to start planning and tracking modifications.
            </p>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Vehicle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {vehicles.map((v) => {
            const completion = calcBuildCompletion(v.modifications);
            const installedMods = v.modifications.filter((m) => m.status === "INSTALLED");
            const installedValue = installedMods.reduce((s, m) => s + (m.price ?? 0), 0);
            const plannedValue = v.modifications
              .filter((m) => m.status !== "INSTALLED")
              .reduce((s, m) => s + (m.price ?? 0), 0);

            return (
              <Card key={v.id} className="overflow-hidden hover:border-theme/30 transition-colors duration-150 group">
                {/* Vehicle Photo */}
                <div className="relative h-44 bg-secondary overflow-hidden">
                  {v.photoUrl ? (
                    <Image src={v.photoUrl} alt={v.name || `${v.year} ${v.make} ${v.model}`} fill className="object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Car className="w-14 h-14 text-muted-foreground/20" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 w-7 p-0 bg-card/90 hover:bg-card"
                      onClick={(e) => { e.preventDefault(); setEditVehicle(v); }}
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 w-7 p-0 bg-card/90 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={(e) => { e.preventDefault(); handleDelete(v.id); }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  {v.color && (
                    <div className="absolute bottom-2 left-2">
                      <Badge variant="secondary" className="text-xs bg-card/90">{v.color}</Badge>
                    </div>
                  )}
                </div>

                <CardContent className="p-5">
                  <div className="mb-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-base leading-tight">
                          {v.name || `${v.year} ${v.make} ${v.model}`}
                        </h3>
                        {v.name && (
                          <p className="text-sm text-muted-foreground">{v.year} {v.make} {v.model}</p>
                        )}
                      </div>
                      {v.trim && (
                        <Badge variant="outline" className="text-xs flex-shrink-0">{v.trim}</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {v.platform && <span className="text-xs text-theme font-medium">{v.platform}</span>}
                      {v.engine && <span className="text-xs text-muted-foreground">{v.engine}</span>}
                      {v.drivetrain && <span className="text-xs text-muted-foreground">{v.drivetrain}</span>}
                    </div>
                    {v.mileage != null && (
                      <p className="text-xs text-muted-foreground mt-1">{v.mileage.toLocaleString()} mi</p>
                    )}
                  </div>

                  <div className="space-y-1.5 mb-4">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Build completion</span>
                      <span className="font-medium text-foreground">{completion}%</span>
                    </div>
                    <Progress value={completion} className="h-1.5" />
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center pb-4 border-b border-border">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Mods</p>
                      <p className="text-sm font-bold">{v._count.modifications}</p>
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

                  <div className="flex gap-2 pt-3">
                    <Link href={`/garage/${v.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1.5">
                        <Car className="w-3.5 h-3.5" />
                        View Details
                      </Button>
                    </Link>
                    <Link href={`/garage/${v.id}`} className="flex-1">
                      <Button size="sm" className="w-full gap-1.5 bg-theme/10 text-theme hover:bg-theme hover:text-white border border-theme/20">
                        <Wrench className="w-3.5 h-3.5" />
                        Build Plan
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
