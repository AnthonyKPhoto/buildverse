"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Car, Wrench, DollarSign, ClipboardList, Edit2, Trash2,
  Plus, ExternalLink, AlertCircle, Clock, Package,
  TrendingUp, Gauge, ArrowUpDown, LayoutList, Grid2X2, BookOpen, FileDown,
} from "lucide-react";
import { AddModDialog } from "@/components/modifications/AddModDialog";
import { AddMaintenanceDialog } from "@/components/maintenance/AddMaintenanceDialog";
import { AddVehicleDialog } from "@/components/vehicles/AddVehicleDialog";
import {
  formatCurrency, formatDate, calcBuildCompletion, calcTotalModValue,
  getStatusConfig, getPriorityConfig, MOD_CATEGORIES, MOD_STATUSES,
} from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Modification {
  id: string; vehicleId: string; name: string; category: string; vendor?: string; brand?: string;
  price?: number | null; actualPrice?: number | null; notes?: string; priority: string;
  status: string; link?: string; imageUrl?: string; difficulty?: string;
  installDate?: string; installMileage?: number | null; laborCost?: number | null;
  diyInstall: boolean; partNumber?: string; orderNumber?: string;
  createdAt: string; updatedAt: string;
}

interface MaintenanceLog {
  id: string; vehicleId: string; service: string; mileage?: number | null;
  date: string; cost?: number | null; notes?: string; shop?: string;
  diy: boolean; nextDue?: string | null; nextMiles?: number | null;
}

interface Budget {
  id: string; vehicleId: string; category: string; planned: number; actual: number; notes?: string;
}

interface Vehicle {
  id: string; name?: string; year: number; make: string; model: string; trim?: string;
  platform?: string; engine?: string; transmission?: string; drivetrain?: string;
  vin?: string; mileage?: number; color?: string; photoUrl?: string; notes?: string;
  modifications: Modification[];
  maintenanceLogs: MaintenanceLog[];
  budgets: Budget[];
}

const STATUS_COLORS: Record<string, string> = {
  PLANNED: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  RESEARCHING: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  ORDERED: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  PURCHASED: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  INSTALLED: "bg-green-500/20 text-green-400 border-green-500/30",
  REMOVED: "bg-red-500/20 text-red-400 border-red-500/30",
};
const PRIORITY_COLORS: Record<string, string> = {
  LOW: "text-slate-400", MEDIUM: "text-yellow-400", HIGH: "text-theme", CRITICAL: "text-red-400",
};

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [editVehicleOpen, setEditVehicleOpen] = useState(false);
  const [addModOpen, setAddModOpen] = useState(false);
  const [editMod, setEditMod] = useState<Modification | null>(null);
  const [addMainOpen, setAddMainOpen] = useState(false);
  const [editLog, setEditLog] = useState<MaintenanceLog | null>(null);
  const [modFilter, setModFilter] = useState({ status: "ALL", category: "ALL", search: "" });
  const [modSort, setModSort] = useState<"date" | "name" | "price" | "status">("date");
  const [modView, setModView] = useState<"normal" | "compact">("normal");
  const [journalNotes, setJournalNotes] = useState("");
  const [savingJournal, setSavingJournal] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [budgetForm, setBudgetForm] = useState({ category: "", planned: "", actual: "" });
  const [savingBudget, setSavingBudget] = useState(false);
  const imageFetchQueue = useRef<Set<string>>(new Set());

  // Silently fetches images for mods that have a link but no imageUrl,
  // saving results to the DB and updating local state as each completes.
  const autoFetchModImages = async (mods: Modification[]) => {
    const needsFetch = mods.filter(
      (m) => m.link && !m.imageUrl && !imageFetchQueue.current.has(m.id)
    );
    if (!needsFetch.length) return;
    needsFetch.forEach((m) => imageFetchQueue.current.add(m.id));

    for (let i = 0; i < needsFetch.length; i += 3) {
      await Promise.allSettled(
        needsFetch.slice(i, i + 3).map(async (mod) => {
          try {
            const res = await fetch(`/api/scrape-image?url=${encodeURIComponent(mod.link!)}`);
            const { imageUrl } = await res.json();
            if (!imageUrl) return;
            await fetch(`/api/modifications/${mod.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageUrl }),
            });
            setVehicle((v) =>
              v
                ? {
                    ...v,
                    modifications: v.modifications.map((m) =>
                      m.id === mod.id ? { ...m, imageUrl } : m
                    ),
                  }
                : v
            );
          } catch {
            // silently skip — image stays missing, user can add manually
          }
        })
      );
    }
  };

  const load = () =>
    fetch(`/api/vehicles/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setVehicle(d);
        setJournalNotes(d.notes ?? "");
        setLoading(false);
        autoFetchModImages(d.modifications ?? []);
      })
      .catch(() => setLoading(false));

  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    const saved = localStorage.getItem("bv-mod-view");
    if (saved === "compact" || saved === "normal") setModView(saved);
  }, []);

  const deleteMod = async (modId: string) => {
    if (!confirm("Delete this modification?")) return;
    const res = await fetch(`/api/modifications/${modId}`, { method: "DELETE" });
    if (res.ok) { load(); toast({ title: "Modification deleted" }); }
    else toast({ title: "Failed to delete", variant: "destructive" });
  };

  const deleteMaintenance = async (logId: string) => {
    if (!confirm("Delete this log entry?")) return;
    const res = await fetch(`/api/maintenance/${logId}`, { method: "DELETE" });
    if (res.ok) { load(); toast({ title: "Log deleted" }); }
    else {
      const data = await res.json().catch(() => ({}));
      toast({ title: "Failed to delete", description: data.error, variant: "destructive" });
    }
  };

  const STATUS_ORDER = ["PLANNED", "RESEARCHING", "ORDERED", "PURCHASED", "INSTALLED", "REMOVED"] as const;
  const cycleStatus = async (mod: Modification) => {
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(mod.status as typeof STATUS_ORDER[number]) + 1) % STATUS_ORDER.length];
    setVehicle((v) => v ? { ...v, modifications: v.modifications.map((m) => m.id === mod.id ? { ...m, status: next } : m) } : v);
    await fetch(`/api/modifications/${mod.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    }).catch(() => {});
  };

  const saveJournal = async () => {
    if (!vehicle) return;
    setSavingJournal(true);
    try {
      await fetch(`/api/vehicles/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: journalNotes }),
      });
      setVehicle((v) => v ? { ...v, notes: journalNotes } : v);
      toast({ title: "Journal saved" });
    } catch { toast({ title: "Failed to save", variant: "destructive" }); }
    finally { setSavingJournal(false); }
  };

  const saveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!budgetForm.category) return;
    setSavingBudget(true);
    try {
      const res = await fetch(`/api/vehicles/${id}/budget`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: budgetForm.category,
          planned: parseFloat(budgetForm.planned) || 0,
          actual: parseFloat(budgetForm.actual) || 0,
        }),
      });
      if (res.ok) { load(); setBudgetForm({ category: "", planned: "", actual: "" }); toast({ title: "Budget updated" }); }
    } finally { setSavingBudget(false); }
  };

  const deleteBudget = async (budgetId: string) => {
    const res = await fetch(`/api/vehicles/${id}/budget/${budgetId}`, { method: "DELETE" });
    if (res.ok) { load(); toast({ title: "Budget item removed" }); }
  };

  const deleteVehicle = async () => {
    if (!confirm(`Delete ${vehicle?.name || vehicle?.make} and all its data? This cannot be undone.`)) return;
    const res = await fetch(`/api/vehicles/${id}`, { method: "DELETE" });
    if (res.ok) { router.push("/garage"); toast({ title: "Vehicle removed" }); }
  };

  const exportPDF = async () => {
    if (!vehicle || exportingPDF) return;
    setExportingPDF(true);
    try {
      const [{ pdf }, { BuildSheetDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/vehicles/BuildSheetPDF"),
      ]);
      const accentColor = localStorage.getItem("bv-accent") || "#e84d3d";
      const blob = await pdf(<BuildSheetDocument vehicle={vehicle} accentColor={accentColor} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(vehicle.name || `${vehicle.year}-${vehicle.make}-${vehicle.model}`).replace(/\s+/g, "-")}-build-sheet.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: "Export failed", description: String(err), variant: "destructive" });
    } finally {
      setExportingPDF(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="w-5 h-5 border-2 border-theme border-t-transparent rounded-full animate-spin" />
          Loading vehicle…
        </div>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Vehicle not found</p>
        <Link href="/garage"><Button className="mt-4" variant="outline">Back to Garage</Button></Link>
      </div>
    );
  }

  const completion = calcBuildCompletion(vehicle.modifications);
  const modValues = calcTotalModValue(vehicle.modifications);
  const totalBudgetPlanned = vehicle.budgets.reduce((s, b) => s + b.planned, 0);
  const totalBudgetActual = vehicle.budgets.reduce((s, b) => s + b.actual, 0);

  // Filter mods
  const filteredMods = vehicle.modifications.filter((m) => {
    if (modFilter.status !== "ALL" && m.status !== modFilter.status) return false;
    if (modFilter.category !== "ALL" && m.category !== modFilter.category) return false;
    if (modFilter.search && !m.name.toLowerCase().includes(modFilter.search.toLowerCase())) return false;
    return true;
  });

  // Sort then group mods by category
  const SORT_STATUS = ["INSTALLED", "PURCHASED", "ORDERED", "RESEARCHING", "PLANNED", "REMOVED"];
  const sortedMods = [...filteredMods].sort((a, b) => {
    if (modSort === "name")   return a.name.localeCompare(b.name);
    if (modSort === "price")  return ((b.actualPrice ?? b.price) ?? 0) - ((a.actualPrice ?? a.price) ?? 0);
    if (modSort === "status") return SORT_STATUS.indexOf(a.status) - SORT_STATUS.indexOf(b.status);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  const modsByCategory = sortedMods.reduce<Record<string, Modification[]>>((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/garage">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <ArrowLeft className="w-4 h-4" />
              Garage
            </Button>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium text-sm">{vehicle.name || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportPDF} disabled={exportingPDF} className="gap-1.5">
            <FileDown className="w-3.5 h-3.5" />
            {exportingPDF ? "Exporting…" : "Export PDF"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditVehicleOpen(true)} className="gap-1.5">
            <Edit2 className="w-3.5 h-3.5" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={deleteVehicle} className="gap-1.5 hover:text-destructive hover:border-destructive">
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Vehicle Header Card */}
      <Card className="overflow-hidden">
        <div className="flex flex-col md:flex-row">
          {/* Photo */}
          <div className="relative w-full md:w-64 h-48 md:h-auto flex-shrink-0 bg-secondary">
            {vehicle.photoUrl ? (
              vehicle.photoUrl.startsWith("data:") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={vehicle.photoUrl} alt={vehicle.name || `${vehicle.year} ${vehicle.make} ${vehicle.model}`} className="w-full h-full object-cover" />
              ) : (
                <Image src={vehicle.photoUrl} alt={vehicle.name || `${vehicle.year} ${vehicle.make} ${vehicle.model}`} fill className="object-cover" />
              )
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Car className="w-20 h-20 text-muted-foreground/20" />
              </div>
            )}
          </div>

          {/* Info */}
          <CardContent className="flex-1 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold">
                  {vehicle.name || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                </h1>
                {vehicle.name && (
                  <p className="text-muted-foreground">{vehicle.year} {vehicle.make} {vehicle.model}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  {vehicle.trim && <Badge variant="outline">{vehicle.trim}</Badge>}
                  {vehicle.platform && (
                    <Badge className="bg-theme/10 text-theme border-theme/20">{vehicle.platform}</Badge>
                  )}
                  {vehicle.drivetrain && <Badge variant="secondary">{vehicle.drivetrain}</Badge>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{completion}%</div>
                <div className="text-xs text-muted-foreground">Build Complete</div>
              </div>
            </div>

            <Progress value={completion} className="h-2 mb-4" />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {vehicle.engine && (
                <div>
                  <p className="text-xs text-muted-foreground">Engine</p>
                  <p className="font-medium">{vehicle.engine}</p>
                </div>
              )}
              {vehicle.transmission && (
                <div>
                  <p className="text-xs text-muted-foreground">Transmission</p>
                  <p className="font-medium">{vehicle.transmission}</p>
                </div>
              )}
              {vehicle.mileage != null && (
                <div>
                  <p className="text-xs text-muted-foreground">Mileage</p>
                  <p className="font-medium">{vehicle.mileage.toLocaleString()} mi</p>
                </div>
              )}
              {vehicle.color && (
                <div>
                  <p className="text-xs text-muted-foreground">Color</p>
                  <p className="font-medium">{vehicle.color}</p>
                </div>
              )}
            </div>

            {/* Value stats */}
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
              <div>
                <p className="text-xs text-muted-foreground">Installed Value</p>
                <p className="text-lg font-bold text-green-400">{formatCurrency(modValues.installed)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Planned Spend</p>
                <p className="text-lg font-bold text-theme">{formatCurrency(modValues.planned)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Build</p>
                <p className="text-lg font-bold">{formatCurrency(modValues.total)}</p>
              </div>
            </div>
          </CardContent>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="mods">
        <TabsList className="grid grid-cols-4 w-full max-w-xl">
          <TabsTrigger value="mods" className="gap-1.5">
            <Wrench className="w-3.5 h-3.5" />
            Mods ({vehicle.modifications.length})
          </TabsTrigger>
          <TabsTrigger value="budget" className="gap-1.5">
            <DollarSign className="w-3.5 h-3.5" />
            Budget
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="gap-1.5">
            <ClipboardList className="w-3.5 h-3.5" />
            Service ({vehicle.maintenanceLogs.length})
          </TabsTrigger>
          <TabsTrigger value="journal" className="gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            Journal
          </TabsTrigger>
        </TabsList>

        {/* ===== MODIFICATIONS TAB ===== */}
        <TabsContent value="mods" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <Input
              placeholder="Search modifications…"
              className="w-52"
              value={modFilter.search}
              onChange={(e) => setModFilter((f) => ({ ...f, search: e.target.value }))}
            />
            <Select value={modFilter.status} onValueChange={(v) => setModFilter((f) => ({ ...f, status: v }))}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                {MOD_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={modFilter.category} onValueChange={(v) => setModFilter((f) => ({ ...f, category: v }))}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                {MOD_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={modSort} onValueChange={(v) => setModSort(v as typeof modSort)}>
              <SelectTrigger className="w-36 gap-1.5">
                <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date Added</SelectItem>
                <SelectItem value="name">Name A–Z</SelectItem>
                <SelectItem value="price">Price High–Low</SelectItem>
                <SelectItem value="status">By Status</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline" size="sm"
              className="px-2.5"
              onClick={() => { const next = modView === "normal" ? "compact" : "normal"; setModView(next); localStorage.setItem("bv-mod-view", next); }}
              title={modView === "normal" ? "Switch to compact view" : "Switch to normal view"}
            >
              {modView === "normal" ? <LayoutList className="w-4 h-4" /> : <Grid2X2 className="w-4 h-4" />}
            </Button>
            <div className="ml-auto">
              <Button onClick={() => setAddModOpen(true)} className="bg-theme hover:brightness-90 gap-2">
                <Plus className="w-4 h-4" />
                Add Modification
              </Button>
            </div>
          </div>

          {/* Grouped mods */}
          {Object.keys(modsByCategory).length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center py-12 text-center">
                <Wrench className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="font-medium mb-1">No modifications {modFilter.status !== "ALL" || modFilter.category !== "ALL" ? "match your filters" : "yet"}</p>
                <p className="text-sm text-muted-foreground mb-4">Start building your mod list</p>
                <Button onClick={() => setAddModOpen(true)} size="sm" className="bg-theme hover:brightness-90">
                  <Plus className="w-4 h-4 mr-1" /> Add First Mod
                </Button>
              </CardContent>
            </Card>
          ) : (
            Object.entries(modsByCategory).map(([category, mods]) => {
              const categoryTotal = mods.reduce((s, m) => s + ((m.actualPrice ?? m.price) ?? 0), 0);
              return (
              <div key={category}>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{category}</h3>
                  <div className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{mods.length}</div>
                  {categoryTotal > 0 && (
                    <span className="text-xs font-semibold text-theme">{formatCurrency(categoryTotal)}</span>
                  )}
                  <div className="flex-1 h-px bg-border ml-2" />
                </div>
                <div className={modView === "compact" ? "space-y-1" : "space-y-2"}>
                  {mods.map((mod) =>
                    modView === "compact" ? (
                      <div key={mod.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors group">
                        <button
                          onClick={() => cycleStatus(mod)}
                          className={`text-xs px-1.5 py-0.5 rounded-full border font-medium hover:opacity-75 transition-opacity flex-shrink-0 ${STATUS_COLORS[mod.status] || STATUS_COLORS.PLANNED}`}
                          title="Click to cycle status"
                        >
                          {mod.status.charAt(0) + mod.status.slice(1).toLowerCase()}
                        </button>
                        <span className="text-sm font-medium flex-1 truncate">{mod.name}</span>
                        {mod.brand && <span className="text-xs text-muted-foreground hidden sm:inline truncate max-w-[120px]">{mod.brand}</span>}
                        {(mod.actualPrice ?? mod.price) != null && (
                          <span className="text-sm font-semibold flex-shrink-0">{formatCurrency((mod.actualPrice ?? mod.price) ?? 0)}</span>
                        )}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          {mod.link && (
                            <a href={mod.link} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0"><ExternalLink className="w-3 h-3" /></Button>
                            </a>
                          )}
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditMod(mod)}><Edit2 className="w-3 h-3" /></Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:text-destructive" onClick={() => deleteMod(mod.id)}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </div>
                    ) : (
                    <Card key={mod.id} className="hover:border-border/60 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {/* Image */}
                          {mod.imageUrl ? (
                            <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-secondary">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={mod.imageUrl} alt={mod.name} className="object-cover w-full h-full" />
                            </div>
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                              <Package className="w-6 h-6 text-muted-foreground/40" />
                            </div>
                          )}

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium text-sm">{mod.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {[mod.brand, mod.vendor].filter(Boolean).join(" · ")}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <button
                                  onClick={() => cycleStatus(mod)}
                                  className={`text-xs px-2 py-0.5 rounded-full border font-medium hover:opacity-75 transition-opacity ${STATUS_COLORS[mod.status] || STATUS_COLORS.PLANNED}`}
                                  title="Click to cycle status"
                                >
                                  {mod.status.charAt(0) + mod.status.slice(1).toLowerCase()}
                                </button>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 mt-2">
                              {mod.price != null && (
                                <span className="text-sm font-semibold">{formatCurrency(mod.price)}</span>
                              )}
                              {mod.priority !== "MEDIUM" && (
                                <span className={`text-xs font-medium ${PRIORITY_COLORS[mod.priority]}`}>
                                  ● {mod.priority.charAt(0) + mod.priority.slice(1).toLowerCase()}
                                </span>
                              )}
                              {mod.difficulty && (
                                <span className="text-xs text-muted-foreground">{mod.difficulty.charAt(0) + mod.difficulty.slice(1).toLowerCase()} install</span>
                              )}
                              {mod.installDate && (
                                <span className="text-xs text-muted-foreground">Installed {formatDate(mod.installDate)}</span>
                              )}
                            </div>

                            {mod.notes && (
                              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{mod.notes}</p>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex gap-1 flex-shrink-0">
                            {mod.link && (
                              <a href={mod.link} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </Button>
                              </a>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditMod(mod)}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:text-destructive" onClick={() => deleteMod(mod.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    )
                  )}
                </div>
              </div>
            );
            })
          )}
        </TabsContent>

        {/* ===== BUDGET TAB ===== */}
        <TabsContent value="budget" className="space-y-4 mt-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total Planned", value: formatCurrency(totalBudgetPlanned), icon: TrendingUp, color: "text-blue-400" },
              { label: "Total Spent", value: formatCurrency(totalBudgetActual), icon: DollarSign, color: "text-green-400" },
              { label: "Remaining", value: formatCurrency(totalBudgetPlanned - totalBudgetActual), icon: Gauge, color: "text-theme" },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label}>
                <CardContent className="p-4 flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${color}`} />
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-lg font-bold">{value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Budget items */}
          {vehicle.budgets.length > 0 && (
            <div className="space-y-3">
              {vehicle.budgets.map((b) => {
                const pct = b.planned > 0 ? Math.min(100, (b.actual / b.planned) * 100) : 0;
                const over = b.actual > b.planned;
                return (
                  <Card key={b.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{b.category}</span>
                          {over && <Badge className="text-xs bg-red-500/20 text-red-400 border-red-500/30">Over budget</Badge>}
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-muted-foreground">{formatCurrency(b.actual)} / {formatCurrency(b.planned)}</span>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:text-destructive" onClick={() => deleteBudget(b.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <Progress value={pct} className={`h-2 ${over ? "[&>div]:bg-red-500" : ""}`} />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Add budget form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Add / Update Budget Category</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveBudget} className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-36">
                  <Input
                    list="budget-categories"
                    placeholder="Category"
                    value={budgetForm.category}
                    onChange={(e) => setBudgetForm((f) => ({ ...f, category: e.target.value }))}
                    required
                  />
                  <datalist id="budget-categories">
                    {MOD_CATEGORIES.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div className="w-32">
                  <Input
                    type="number" min="0" step="0.01" placeholder="Planned ($)"
                    value={budgetForm.planned}
                    onChange={(e) => setBudgetForm((f) => ({ ...f, planned: e.target.value }))}
                  />
                </div>
                <div className="w-32">
                  <Input
                    type="number" min="0" step="0.01" placeholder="Actual ($)"
                    value={budgetForm.actual}
                    onChange={(e) => setBudgetForm((f) => ({ ...f, actual: e.target.value }))}
                  />
                </div>
                <Button type="submit" disabled={savingBudget} className="bg-theme hover:brightness-90">
                  {savingBudget ? "Saving…" : "Save Budget"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== MAINTENANCE TAB ===== */}
        <TabsContent value="maintenance" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => setAddMainOpen(true)} className="bg-theme hover:brightness-90 gap-2">
              <Plus className="w-4 h-4" />
              Log Service
            </Button>
          </div>

          {vehicle.maintenanceLogs.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center py-12 text-center">
                <ClipboardList className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="font-medium mb-1">No maintenance logs yet</p>
                <p className="text-sm text-muted-foreground mb-4">Track service history to never miss a service interval</p>
                <Button onClick={() => setAddMainOpen(true)} size="sm" className="bg-theme hover:brightness-90">
                  <Plus className="w-4 h-4 mr-1" /> Log First Service
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {vehicle.maintenanceLogs.map((log) => (
                <Card key={log.id} className="hover:border-border/60 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                          <ClipboardList className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{log.service}</p>
                          <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{formatDate(log.date)}</span>
                            {log.mileage != null && <span>{log.mileage.toLocaleString()} mi</span>}
                            {log.cost != null && <span className="text-foreground">{formatCurrency(log.cost)}</span>}
                            {log.shop && <span>{log.diy ? "DIY" : log.shop}</span>}
                          </div>
                          {log.notes && <p className="text-xs text-muted-foreground mt-1">{log.notes}</p>}
                          {(log.nextDue || log.nextMiles) && (
                            <div className="flex items-center gap-1 mt-1.5">
                              <Clock className="w-3 h-3 text-theme" />
                              <span className="text-xs text-theme">
                                Next: {log.nextDue ? formatDate(log.nextDue) : ""}{log.nextDue && log.nextMiles ? " · " : ""}
                                {log.nextMiles ? `${log.nextMiles.toLocaleString()} mi` : ""}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditLog(log)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:text-destructive" onClick={() => deleteMaintenance(log.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ===== JOURNAL TAB ===== */}
        <TabsContent value="journal" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Build Journal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                className="w-full min-h-[320px] resize-y bg-secondary/30 rounded-lg border border-border p-3 text-sm focus:outline-none focus:ring-1 focus:ring-theme"
                placeholder="Document your build journey — plans, decisions, notes, lessons learned…"
                value={journalNotes}
                onChange={(e) => setJournalNotes(e.target.value)}
              />
              <div className="flex justify-end">
                <Button onClick={saveJournal} disabled={savingJournal} className="bg-theme hover:brightness-90">
                  {savingJournal ? "Saving…" : "Save Journal"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddVehicleDialog
        open={editVehicleOpen}
        onOpenChange={setEditVehicleOpen}
        onCreated={() => { setEditVehicleOpen(false); load(); }}
        editVehicle={vehicle}
      />
      <AddModDialog
        open={addModOpen || !!editMod}
        onOpenChange={(o) => { if (!o) { setAddModOpen(false); setEditMod(null); } }}
        vehicleId={id}
        onSaved={() => { setAddModOpen(false); setEditMod(null); load(); }}
        editMod={editMod}
      />
      <AddMaintenanceDialog
        open={addMainOpen || !!editLog}
        onOpenChange={(o) => { if (!o) { setAddMainOpen(false); setEditLog(null); } }}
        vehicleId={id}
        onSaved={() => { setAddMainOpen(false); setEditLog(null); load(); }}
        editLog={editLog}
      />
    </div>
  );
}
