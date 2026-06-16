"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ClipboardList, Plus, Edit2, Trash2, Car, Clock,
  Wrench, Search, AlertTriangle, DollarSign, CalendarDays, Zap,
} from "lucide-react";
import { AddMaintenanceDialog } from "@/components/maintenance/AddMaintenanceDialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Vehicle { id: string; name?: string; year: number; make: string; model: string; }

interface MaintenanceLog {
  id: string; vehicleId: string; service: string; mileage?: number | null;
  date: string; cost?: number | null; notes?: string; shop?: string;
  diy: boolean; nextDue?: string | null; nextMiles?: number | null;
  vehicle: Vehicle;
}

export default function MaintenancePage() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [editLog, setEditLog] = useState<MaintenanceLog | null>(null);
  const [addForVehicle, setAddForVehicle] = useState<string | null>(null);
  const [filterVehicle, setFilterVehicle] = useState("ALL");
  const [search, setSearch] = useState("");

  const load = async () => {
    try {
      const [logsData, vehiclesData] = await Promise.all([
        fetch("/api/maintenance").then((r) => r.json()),
        fetch("/api/vehicles").then((r) => r.json()),
      ]);
      setLogs(Array.isArray(logsData) ? logsData : []);
      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this maintenance log?")) return;
    const res = await fetch(`/api/maintenance/${id}`, { method: "DELETE" });
    if (res.ok) {
      setLogs((l) => l.filter((x) => x.id !== id));
      toast({ title: "Log deleted" });
    } else {
      const data = await res.json().catch(() => ({}));
      toast({ title: "Failed to delete", description: data.error, variant: "destructive" });
    }
  };

  const filtered = logs.filter((l) => {
    if (filterVehicle !== "ALL" && l.vehicleId !== filterVehicle) return false;
    if (search && !l.service.toLowerCase().includes(search.toLowerCase()) &&
        !l.vehicle?.make?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalCost = filtered.reduce((s, l) => s + (l.cost ?? 0), 0);
  const now = new Date();

  const upcoming = logs.filter((l) => {
    if (!l.nextDue) return false;
    const daysUntil = (new Date(l.nextDue).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntil <= 90 && daysUntil > 0;
  }).sort((a, b) => new Date(a.nextDue!).getTime() - new Date(b.nextDue!).getTime());

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-muted-foreground text-sm">
          <div className="w-4 h-4 border-2 border-theme border-t-transparent rounded-full animate-spin" />
          Loading maintenance logs…
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Hero banner */}
      <div className="-mx-6 -mt-8 mb-8 px-6 pt-8 pb-6 border-b border-border/60 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-blue-500/5 pointer-events-none" />
        <div className="absolute top-0 right-0 w-72 h-36 bg-blue-500/8 rounded-full blur-3xl -translate-y-8 translate-x-8 pointer-events-none" />
        <div className="relative">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs font-medium text-muted-foreground/60 tracking-wider uppercase mb-1">Maintenance</p>
              <h1 className="text-3xl font-bold tracking-tight">Service History</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {logs.length === 0
                  ? "No logs yet — start tracking your service history"
                  : `${logs.length} service${logs.length !== 1 ? "s" : ""} logged`}
              </p>
            </div>
            {vehicles.length > 0 && (
              <Select value={addForVehicle ?? ""} onValueChange={(v) => setAddForVehicle(v)}>
                <SelectTrigger className="w-auto bg-theme text-white hover:brightness-90 border-theme h-9 text-sm gap-2">
                  <Plus className="w-4 h-4" />
                  <SelectValue placeholder="Log Service" />
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

          {/* Stats row */}
          {logs.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Total Services", value: logs.length.toString(),       icon: ClipboardList, color: "text-blue-400",  bg: "bg-blue-500/10" },
                { label: "Total Cost",     value: formatCurrency(totalCost),    icon: DollarSign,    color: "text-amber-400", bg: "bg-amber-500/10" },
                { label: "Due Soon",       value: upcoming.length.toString(),   icon: CalendarDays,  color: "text-theme",     bg: "bg-theme/10" },
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

      {/* Upcoming services alert */}
      {upcoming.length > 0 && (
        <div className="rounded-xl border border-theme/30 bg-theme/5 p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-theme" />
            <h3 className="text-sm font-semibold text-theme">Services Due Soon</h3>
          </div>
          <div className="space-y-2">
            {upcoming.slice(0, 3).map((l) => {
              const daysUntil = Math.ceil((new Date(l.nextDue!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div key={l.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{l.service}</span>
                    <span className="text-muted-foreground text-xs">
                      {l.vehicle?.name || `${l.vehicle?.year} ${l.vehicle?.make} ${l.vehicle?.model}`}
                    </span>
                  </div>
                  <Badge className={`text-xs ${daysUntil <= 30 ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-theme/20 text-theme border-theme/30"}`}>
                    {daysUntil <= 0 ? "Overdue" : `${daysUntil} days`}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {vehicles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-2xl bg-blue-500/10 ring-1 ring-blue-500/20 flex items-center justify-center mb-5">
            <Zap className="w-10 h-10 text-blue-400" />
          </div>
          <h2 className="text-xl font-bold mb-2">No vehicles yet</h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Add a vehicle in the Garage to start tracking maintenance history.
          </p>
          <Link href="/garage">
            <Button className="gap-2"><Car className="w-4 h-4" /> Go to Garage</Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-5">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search services…"
                className="pl-8 w-52"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterVehicle} onValueChange={setFilterVehicle}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Vehicles</SelectItem>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name || `${v.year} ${v.make} ${v.model}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filtered.length > 0 && (
              <p className="text-sm text-muted-foreground self-center ml-auto">
                {filtered.length} result{filtered.length !== 1 ? "s" : ""} · {formatCurrency(totalCost)}
              </p>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-border">
              <ClipboardList className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="font-medium mb-1">No maintenance logs yet</p>
              <p className="text-sm text-muted-foreground">Select a vehicle above to log your first service</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((log) => {
                const vehicleName = log.vehicle?.name || (log.vehicle ? `${log.vehicle.year} ${log.vehicle.make} ${log.vehicle.model}` : "Unknown");
                const isDueSoon = log.nextDue && (new Date(log.nextDue).getTime() - now.getTime()) / (1000 * 60 * 60 * 24) <= 30;

                return (
                  <div key={log.id} className="flex items-start gap-3 rounded-xl border border-border/60 bg-card px-4 py-3.5 hover:border-border transition-colors group">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Wrench className="w-4 h-4 text-blue-400" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm">{log.service}</p>
                          <Link href={`/garage/${log.vehicleId}`} className="text-xs text-theme/80 hover:text-theme transition-colors">
                            {vehicleName}
                          </Link>
                        </div>
                        {log.cost != null && (
                          <span className="text-sm font-semibold shrink-0">{formatCurrency(log.cost)}</span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{formatDate(log.date)}</span>
                        {log.mileage != null && <span>{log.mileage.toLocaleString()} mi</span>}
                        {log.diy ? (
                          <Badge variant="outline" className="text-xs h-4">DIY</Badge>
                        ) : log.shop ? (
                          <span>{log.shop}</span>
                        ) : null}
                      </div>

                      {log.notes && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{log.notes}</p>
                      )}

                      {(log.nextDue || log.nextMiles) && (
                        <div className={`flex items-center gap-1.5 mt-1 text-xs ${isDueSoon ? "text-theme" : "text-muted-foreground"}`}>
                          <Clock className="w-3 h-3" />
                          <span>
                            Next: {log.nextDue ? formatDate(log.nextDue) : ""}
                            {log.nextDue && log.nextMiles ? " · " : ""}
                            {log.nextMiles ? `${log.nextMiles.toLocaleString()} mi` : ""}
                          </span>
                          {isDueSoon && <Badge className="text-xs bg-theme/20 text-theme border-theme/30 h-4">Due soon</Badge>}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditLog(log)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:text-destructive" onClick={() => handleDelete(log.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {editLog && (
        <AddMaintenanceDialog
          open={!!editLog}
          onOpenChange={(o) => { if (!o) setEditLog(null); }}
          vehicleId={editLog.vehicleId}
          onSaved={() => { setEditLog(null); load(); }}
          editLog={editLog}
        />
      )}

      {addForVehicle && (
        <AddMaintenanceDialog
          open={!!addForVehicle}
          onOpenChange={(o) => { if (!o) setAddForVehicle(null); }}
          vehicleId={addForVehicle}
          onSaved={() => { setAddForVehicle(null); load(); }}
        />
      )}
    </div>
  );
}
