"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wrench, ExternalLink, Edit2, Trash2, Package, Car, Plus, Search } from "lucide-react";
import { AddModDialog } from "@/components/modifications/AddModDialog";
import { formatCurrency, MOD_CATEGORIES, MOD_STATUSES, getPriorityConfig } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Vehicle { id: string; name?: string; year: number; make: string; model: string; }

interface Modification {
  id: string; vehicleId: string; name: string; category: string; vendor?: string; brand?: string;
  price?: number | null; actualPrice?: number | null; notes?: string; priority: string;
  status: string; link?: string; imageUrl?: string; difficulty?: string;
  installDate?: string; installMileage?: number | null; laborCost?: number | null;
  diyInstall: boolean; partNumber?: string; orderNumber?: string;
  vehicle: Vehicle;
}

const STATUS_COLORS: Record<string, string> = {
  PLANNED:     "bg-slate-500/20 text-slate-400 border-slate-500/30",
  RESEARCHING: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  ORDERED:     "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  PURCHASED:   "bg-purple-500/20 text-purple-400 border-purple-500/30",
  INSTALLED:   "bg-green-500/20 text-green-400 border-green-500/30",
  REMOVED:     "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function BuildsPage() {
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [mods, setMods] = useState<Modification[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMod, setEditMod] = useState<Modification | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<string>("ALL");
  const [addModFor, setAddModFor] = useState<string | null>(null);
  const [filters, setFilters] = useState({ status: "ALL", category: "ALL", priority: "ALL", search: "" });

  const load = () =>
    fetch("/api/builds")
      .then((r) => r.json())
      .then((d) => { setVehicles(d.vehicles ?? []); setMods(d.modifications ?? []); setLoading(false); })
      .catch(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this modification?")) return;
    const res = await fetch(`/api/modifications/${id}`, { method: "DELETE" });
    if (res.ok) { setMods((m) => m.filter((x) => x.id !== id)); toast({ title: "Modification deleted" }); }
    else toast({ title: "Failed to delete", variant: "destructive" });
  };

  const filtered = mods.filter((m) => {
    if (selectedVehicle !== "ALL" && m.vehicleId !== selectedVehicle) return false;
    if (filters.status !== "ALL" && m.status !== filters.status) return false;
    if (filters.category !== "ALL" && m.category !== filters.category) return false;
    if (filters.priority !== "ALL" && m.priority !== filters.priority) return false;
    if (filters.search && !m.name.toLowerCase().includes(filters.search.toLowerCase()) &&
        !m.brand?.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  const grouped = filtered.reduce<Record<string, Modification[]>>((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {});

  const totalValue = filtered.reduce((s, m) => s + (m.price ?? 0), 0);
  const installedCount = filtered.filter((m) => m.status === "INSTALLED").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-muted-foreground text-sm">
          <div className="w-4 h-4 border-2 border-theme border-t-transparent rounded-full animate-spin" />
          Loading build plans…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Build Plans</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} modification{filtered.length !== 1 ? "s" : ""} · {installedCount} installed · {formatCurrency(totalValue)} total
          </p>
        </div>
        {vehicles.length > 0 && (
          <Select value={addModFor ?? ""} onValueChange={(v) => setAddModFor(v)}>
            <SelectTrigger className="w-auto bg-theme text-white hover:brightness-90 border-theme">
              <Plus className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Add Modification" />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name || `${v.year} ${v.make} ${v.model}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {vehicles.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Wrench className="w-10 h-10 text-muted-foreground/30 mb-4" />
            <h3 className="text-base font-semibold mb-1.5">No vehicles in garage</h3>
            <p className="text-muted-foreground text-sm mb-5">Add a vehicle first to start planning modifications</p>
            <Link href="/garage">
              <Button>
                <Car className="w-4 h-4 mr-2" />
                Go to Garage
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search mods…"
                className="pl-8 w-52"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              />
            </div>
            <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Vehicles</SelectItem>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name || `${v.year} ${v.make} ${v.model}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                {MOD_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.category} onValueChange={(v) => setFilters((f) => ({ ...f, category: v }))}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                {MOD_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.priority} onValueChange={(v) => setFilters((f) => ({ ...f, priority: v }))}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Priority</SelectItem>
                {[{ value: "NONE", label: "None" }, { value: "LOW", label: "Low" }, { value: "MEDIUM", label: "Medium" }, { value: "HIGH", label: "High" }, { value: "CRITICAL", label: "Critical" }].map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {Object.keys(grouped).length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center py-10 text-center">
                <Search className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="font-medium">No modifications match your filters</p>
                <Button variant="ghost" size="sm" className="mt-3" onClick={() => setFilters({ status: "ALL", category: "ALL", priority: "ALL", search: "" })}>
                  Clear filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([category, categoryMods]) => (
              <div key={category}>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{category}</h3>
                  <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{categoryMods.length}</span>
                  <div className="flex-1 h-px bg-border ml-1" />
                  <span className="text-xs text-muted-foreground">{formatCurrency(categoryMods.reduce((s, m) => s + (m.price ?? 0), 0))}</span>
                </div>

                <div className="space-y-2">
                  {categoryMods.map((mod) => {
                    const vehicleName = mod.vehicle.name || `${mod.vehicle.year} ${mod.vehicle.make} ${mod.vehicle.model}`;
                    return (
                      <Card key={mod.id} className="hover:border-border/60 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            {mod.imageUrl ? (
                              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-secondary">
                                <Image src={mod.imageUrl} alt={mod.name} width={48} height={48} className="object-cover w-full h-full" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                                <Package className="w-4 h-4 text-muted-foreground/40" />
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-medium text-sm">{mod.name}</p>
                                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                    {mod.brand && <span className="text-xs text-muted-foreground">{mod.brand}</span>}
                                    <span className="text-xs text-theme/80">{vehicleName}</span>
                                  </div>
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${STATUS_COLORS[mod.status] || STATUS_COLORS.PLANNED}`}>
                                  {mod.status.charAt(0) + mod.status.slice(1).toLowerCase()}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-3 mt-1.5">
                                {mod.price != null && <span className="text-sm font-semibold">{formatCurrency(mod.price)}</span>}
                                {mod.vendor && <span className="text-xs text-muted-foreground">{mod.vendor}</span>}
                                {mod.priority !== "NONE" && mod.priority !== "MEDIUM" && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getPriorityConfig(mod.priority).badge}`}>
                                    {mod.priority === "CRITICAL" ? "⚠ Critical" : mod.priority.charAt(0) + mod.priority.slice(1).toLowerCase()}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-1 flex-shrink-0">
                              {mod.link && (
                                <a href={mod.link} target="_blank" rel="noopener noreferrer">
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0"><ExternalLink className="w-3.5 h-3.5" /></Button>
                                </a>
                              )}
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditMod(mod)}>
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:text-destructive" onClick={() => handleDelete(mod.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </>
      )}

      {editMod && (
        <AddModDialog
          open={!!editMod}
          onOpenChange={(o) => { if (!o) setEditMod(null); }}
          vehicleId={editMod.vehicleId}
          onSaved={() => { setEditMod(null); load(); }}
          editMod={editMod}
        />
      )}

      {addModFor && (
        <AddModDialog
          open={!!addModFor}
          onOpenChange={(o) => { if (!o) setAddModFor(null); }}
          vehicleId={addModFor}
          onSaved={() => { setAddModFor(null); load(); }}
        />
      )}
    </div>
  );
}
