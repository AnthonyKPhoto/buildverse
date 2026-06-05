"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Plus, Edit2, Trash2, Car, Clock, Wrench, Search, AlertTriangle } from "lucide-react";
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
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const filtered = logs.filter((l) => {
    if (filterVehicle !== "ALL" && l.vehicleId !== filterVehicle) return false;
    if (search && !l.service.toLowerCase().includes(search.toLowerCase()) &&
        !l.vehicle?.make?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalCost = filtered.reduce((s, l) => s + (l.cost ?? 0), 0);

  // Upcoming services
  const now = new Date();
  const upcoming = logs.filter((l) => {
    if (!l.nextDue) return false;
    const due = new Date(l.nextDue);
    const daysUntil = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntil <= 90 && daysUntil > 0;
  }).sort((a, b) => new Date(a.nextDue!).getTime() - new Date(b.nextDue!).getTime());

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="w-5 h-5 border-2 border-theme border-t-transparent rounded-full animate-spin" />
          Loading maintenance logs…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Maintenance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} service{filtered.length !== 1 ? "s" : ""} · {formatCurrency(totalCost)} total cost
          </p>
        </div>
        <div className="flex gap-2">
          {vehicles.length > 0 && (
            <Select value={addForVehicle ?? ""} onValueChange={(v) => setAddForVehicle(v)}>
              <SelectTrigger className="w-auto bg-theme text-white hover:brightness-90 border-theme">
                <Plus className="w-4 h-4 mr-2" />
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
      </div>

      {/* Upcoming services alert */}
      {upcoming.length > 0 && (
        <Card className="border-theme/30 bg-theme/5">
          <CardContent className="p-4">
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
                        {l.vehicle.name || `${l.vehicle.year} ${l.vehicle.make} ${l.vehicle.model}`}
                      </span>
                    </div>
                    <Badge className={`text-xs ${daysUntil <= 30 ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-theme/20 text-theme border-theme/30"}`}>
                      {daysUntil <= 0 ? "Overdue" : `${daysUntil} days`}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {vehicles.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <ClipboardList className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No vehicles yet</h3>
            <p className="text-muted-foreground text-sm mb-6">Add a vehicle to start tracking maintenance history</p>
            <Link href="/garage">
              <Button><Car className="w-4 h-4 mr-2" />Go to Garage</Button>
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
          </div>

          {filtered.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center py-12 text-center">
                <ClipboardList className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="font-medium mb-1">No maintenance logs yet</p>
                <p className="text-sm text-muted-foreground">Select a vehicle above to log your first service</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((log) => {
                const vehicleName = log.vehicle?.name || (log.vehicle ? `${log.vehicle.year} ${log.vehicle.make} ${log.vehicle.model}` : "Unknown");
                const isDueSoon = log.nextDue && (new Date(log.nextDue).getTime() - now.getTime()) / (1000 * 60 * 60 * 24) <= 30;

                return (
                  <Card key={log.id} className="hover:border-border/60 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Wrench className="w-5 h-5 text-muted-foreground" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-sm">{log.service}</p>
                              <Link href={`/garage/${log.vehicleId}`} className="text-xs text-theme/80 hover:text-theme transition-colors">
                                {vehicleName}
                              </Link>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {log.cost != null && (
                                <span className="text-sm font-semibold">{formatCurrency(log.cost)}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
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
                            <div className={`flex items-center gap-1.5 mt-1.5 text-xs ${isDueSoon ? "text-theme" : "text-muted-foreground"}`}>
                              <Clock className="w-3 h-3" />
                              <span>
                                Next service: {log.nextDue ? formatDate(log.nextDue) : ""}
                                {log.nextDue && log.nextMiles ? " · " : ""}
                                {log.nextMiles ? `${log.nextMiles.toLocaleString()} mi` : ""}
                              </span>
                              {isDueSoon && <Badge className="text-xs bg-theme/20 text-theme border-theme/30 h-4">Due soon</Badge>}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-1 flex-shrink-0">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditLog(log)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:text-destructive" onClick={() => handleDelete(log.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Edit log dialog */}
      {editLog && (
        <AddMaintenanceDialog
          open={!!editLog}
          onOpenChange={(o) => { if (!o) setEditLog(null); }}
          vehicleId={editLog.vehicleId}
          onSaved={() => { setEditLog(null); load(); }}
          editLog={editLog}
        />
      )}

      {/* Add log dialog */}
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
