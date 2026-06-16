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
  TrendingUp, Gauge, ArrowUpDown, LayoutList, Grid2X2, BookOpen, FileDown, FolderOpen,
  Kanban, FileSpreadsheet, Activity, CalendarDays, Images, X, ChevronLeft, ChevronRight,
  Share2, Link2 as LinkIcon, ShieldAlert, Instagram, Facebook, Tag, Download,
} from "lucide-react";
import { AddModDialog } from "@/components/modifications/AddModDialog";
import { AddMaintenanceDialog } from "@/components/maintenance/AddMaintenanceDialog";
import { AddVehicleDialog } from "@/components/vehicles/AddVehicleDialog";
import { PDFExportDialog } from "@/components/vehicles/PDFExportDialog";
import { VehicleFilesTab } from "@/components/vehicles/VehicleFilesTab";
import { DynoTab } from "@/components/vehicles/DynoTab";
import { KanbanView } from "@/components/vehicles/KanbanView";
import { TuneLogsTab } from "@/components/vehicles/TuneLogsTab";
import { LinksTab } from "@/components/vehicles/LinksTab";
import { CSVImportDialog } from "@/components/modifications/CSVImportDialog";
import {
  formatCurrency, formatDate, calcBuildCompletion, calcTotalModValue,
  getStatusConfig, getPriorityConfig, MOD_CATEGORIES, MOD_STATUSES,
} from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useCategories } from "@/hooks/use-categories";

interface ModDep {
  id: string;
  dependsOn: { id: string; name: string; status: string };
}
interface Modification {
  id: string; vehicleId: string; name: string; category: string; vendor?: string; brand?: string;
  price?: number | null; actualPrice?: number | null; notes?: string; priority: string;
  status: string; link?: string; imageUrl?: string; difficulty?: string;
  installDate?: string; installMileage?: number | null; laborCost?: number | null;
  diyInstall: boolean; partNumber?: string; orderNumber?: string;
  createdAt: string; updatedAt: string;
  dependencies?: ModDep[];
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
  instagramUrl?: string; facebookUrl?: string;
  modifications: Modification[];
  maintenanceLogs: MaintenanceLog[];
  budgets: Budget[];
}

interface RecallResult {
  campaignNumber: string; component: string; summary: string;
  consequence: string; remedy: string; nhtsaUrl: string; reportDate: string;
}

interface TrackedPrice {
  id: string; title: string; currentPrice: number | null;
  lowestPrice: number | null; highestPrice: number | null;
}

const STATUS_COLORS: Record<string, string> = {
  PLANNED: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  RESEARCHING: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  ORDERED: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  PURCHASED: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  INSTALLED: "bg-green-500/20 text-green-400 border-green-500/30",
  REMOVED: "bg-red-500/20 text-red-400 border-red-500/30",
};
const PRIORITY_BADGE: Record<string, string> = {
  LOW:      "bg-slate-500/15 text-slate-400 border-slate-500/25",
  MEDIUM:   "bg-amber-500/15 text-amber-400 border-amber-500/25",
  HIGH:     "bg-orange-500/15 text-orange-400 border-orange-500/25",
  CRITICAL: "bg-red-500/20 text-red-400 border-red-400/40",
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
  const [modSort, setModSort] = useState<"date" | "name" | "price" | "status" | "priority">("date");
  const [modView, setModView] = useState<"normal" | "compact" | "kanban" | "timeline" | "gallery">("normal");
  const [lightboxMod, setLightboxMod] = useState<Modification | null>(null);
  const [buildCardOpen, setBuildCardOpen] = useState(false);
  const [bcImgError, setBcImgError] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [journalNotes, setJournalNotes] = useState("");
  const [savingJournal, setSavingJournal] = useState(false);
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

  const handleDownloadBuildCard = async () => {
    const el = document.getElementById("build-card");
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const api = (window as Window & { electronAPI?: { captureBuildCard?: (r: object) => Promise<string | null> } }).electronAPI;
    if (!api?.captureBuildCard) return;
    const base64 = await api.captureBuildCard({
      x: Math.round(rect.left), y: Math.round(rect.top),
      width: Math.round(rect.width), height: Math.round(rect.height),
    });
    if (!base64) return;
    const label = vehicle?.name || `${vehicle?.year}-${vehicle?.make}-${vehicle?.model}`;
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${base64}`;
    a.download = `${label.replace(/\s+/g, "-")}-build-card.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
    if (saved === "compact" || saved === "normal" || saved === "kanban" || saved === "timeline" || saved === "gallery") setModView(saved);
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

  const cycleModStatus = async (modId: string, newStatus: string) => {
    setVehicle((v) => v ? { ...v, modifications: v.modifications.map((m) => m.id === modId ? { ...m, status: newStatus } : m) } : v);
    await fetch(`/api/modifications/${modId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    }).catch(() => {});
  };

  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [recallOpen, setRecallOpen] = useState(false);
  const [recalls, setRecalls] = useState<RecallResult[] | null>(null);
  const [recallLoading, setRecallLoading] = useState(false);
  // url → tracked price, lazy-loaded when mod card is hovered
  const [priceCache, setPriceCache] = useState<Record<string, TrackedPrice | null>>({});
  const { categories: modCategories } = useCategories();

  const checkRecalls = async () => {
    setRecallOpen(true);
    if (recalls !== null) return; // already loaded
    setRecallLoading(true);
    try {
      const res = await fetch(`/api/vehicles/${id}/recalls`);
      const data = await res.json();
      setRecalls(Array.isArray(data.recalls) ? data.recalls : []);
    } catch {
      setRecalls([]);
    } finally {
      setRecallLoading(false);
    }
  };

  const lookupPrice = async (url: string) => {
    if (url in priceCache) return;
    setPriceCache((prev) => ({ ...prev, [url]: null })); // mark as loading
    try {
      const res = await fetch(`/api/products/lookup?url=${encodeURIComponent(url)}`);
      const { product } = await res.json();
      setPriceCache((prev) => ({ ...prev, [url]: product ?? null }));
    } catch {
      setPriceCache((prev) => ({ ...prev, [url]: null }));
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
  const SORT_STATUS   = ["INSTALLED", "PURCHASED", "ORDERED", "RESEARCHING", "PLANNED", "REMOVED"];
  const SORT_PRIORITY = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"];
  const sortedMods = [...filteredMods].sort((a, b) => {
    if (modSort === "name")     return a.name.localeCompare(b.name);
    if (modSort === "price")    return ((b.actualPrice ?? b.price) ?? 0) - ((a.actualPrice ?? a.price) ?? 0);
    if (modSort === "status")   return SORT_STATUS.indexOf(a.status) - SORT_STATUS.indexOf(b.status);
    if (modSort === "priority") return SORT_PRIORITY.indexOf(a.priority) - SORT_PRIORITY.indexOf(b.priority);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  const modsByCategory = sortedMods.reduce<Record<string, Modification[]>>((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {});

  const renderModCard = (mod: Modification) =>
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
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{mod.name}</p>
                  <p className="text-xs text-muted-foreground">{[mod.brand, mod.vendor].filter(Boolean).join(" · ")}</p>
                </div>
                <button
                  onClick={() => cycleStatus(mod)}
                  className={`text-xs px-2 py-0.5 rounded-full border font-medium hover:opacity-75 transition-opacity flex-shrink-0 ${STATUS_COLORS[mod.status] || STATUS_COLORS.PLANNED}`}
                  title="Click to cycle status"
                >
                  {mod.status.charAt(0) + mod.status.slice(1).toLowerCase()}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                {mod.price != null && <span className="text-sm font-semibold">{formatCurrency(mod.price)}</span>}
                {mod.priority !== "NONE" && PRIORITY_BADGE[mod.priority] && (
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PRIORITY_BADGE[mod.priority]}`}>
                    {mod.priority === "CRITICAL" ? "⚠ Critical" : mod.priority.charAt(0) + mod.priority.slice(1).toLowerCase()}
                  </span>
                )}
                {mod.difficulty && <span className="text-xs text-muted-foreground">{mod.difficulty.charAt(0) + mod.difficulty.slice(1).toLowerCase()} install</span>}
                {mod.installDate && <span className="text-xs text-muted-foreground">Installed {formatDate(mod.installDate)}</span>}
              </div>
              {mod.notes && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{mod.notes}</p>}
              {/* Price tracking badge */}
              {mod.link && (() => {
                const tracked = priceCache[mod.link];
                if (tracked === undefined && mod.link) {
                  // Trigger lazy lookup on first render of this mod card
                  setTimeout(() => lookupPrice(mod.link!), 0);
                }
                if (!tracked) return null;
                return (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Tag className="w-3 h-3 text-theme" />
                    <span className="text-xs text-theme font-medium">
                      Tracking: {tracked.currentPrice != null ? `$${tracked.currentPrice.toFixed(2)}` : "No price"}
                    </span>
                    {tracked.lowestPrice != null && tracked.currentPrice != null && tracked.currentPrice <= tracked.lowestPrice && (
                      <span className="text-xs text-green-400">· Lowest ever!</span>
                    )}
                    {tracked.highestPrice != null && tracked.currentPrice != null && tracked.currentPrice < tracked.highestPrice && (
                      <span className="text-xs text-blue-400">· {Math.round((tracked.highestPrice - tracked.currentPrice) / tracked.highestPrice * 100)}% off peak</span>
                    )}
                  </div>
                );
              })()}
              {mod.dependencies && mod.dependencies.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {mod.dependencies.map((dep) => (
                    <span
                      key={dep.id}
                      title={`Requires: ${dep.dependsOn.name} (${dep.dependsOn.status})`}
                      className={`text-xs px-1.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                        dep.dependsOn.status === "INSTALLED"
                          ? "bg-green-500/10 text-green-400/70 border-green-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}
                    >
                      {dep.dependsOn.status !== "INSTALLED" && "⚠ "}Requires: {dep.dependsOn.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              {mod.link && (
                <a href={mod.link} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0"><ExternalLink className="w-3.5 h-3.5" /></Button>
                </a>
              )}
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditMod(mod)}><Edit2 className="w-3.5 h-3.5" /></Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:text-destructive" onClick={() => deleteMod(mod.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );

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
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="outline" size="sm" onClick={checkRecalls} className="gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            Recalls
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setBcImgError(false); setBuildCardOpen(true); }} className="gap-1.5">
            <Share2 className="w-3.5 h-3.5" />
            Build Card
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPdfDialogOpen(true)} className="gap-1.5">
            <FileDown className="w-3.5 h-3.5" />
            Export PDF
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

            {/* Social links */}
            {(vehicle.instagramUrl || vehicle.facebookUrl) && (
              <div className="flex gap-3 mt-2">
                {vehicle.instagramUrl && (
                  <a href={vehicle.instagramUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-pink-400 transition-colors">
                    <Instagram className="w-3.5 h-3.5" /> Instagram
                  </a>
                )}
                {vehicle.facebookUrl && (
                  <a href={vehicle.facebookUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-blue-400 transition-colors">
                    <Facebook className="w-3.5 h-3.5" /> Facebook
                  </a>
                )}
              </div>
            )}

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
        <TabsList className="grid grid-cols-8 w-full max-w-4xl">
          <TabsTrigger value="mods" className="gap-1">
            <Wrench className="w-3 h-3" />
            Mods
          </TabsTrigger>
          <TabsTrigger value="budget" className="gap-1">
            <DollarSign className="w-3 h-3" />
            Budget
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="gap-1">
            <ClipboardList className="w-3 h-3" />
            Service
          </TabsTrigger>
          <TabsTrigger value="journal" className="gap-1">
            <BookOpen className="w-3 h-3" />
            Journal
          </TabsTrigger>
          <TabsTrigger value="links" className="gap-1">
            <LinkIcon className="w-3 h-3" />
            Links
          </TabsTrigger>
          <TabsTrigger value="files" className="gap-1">
            <FolderOpen className="w-3 h-3" />
            Files
          </TabsTrigger>
          <TabsTrigger value="dyno" className="gap-1.5">
            <Gauge className="w-3.5 h-3.5" />
            Dyno
          </TabsTrigger>
          <TabsTrigger value="tunelogs" className="gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            Logs
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
                {modCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
                <SelectItem value="priority">By Priority</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline" size="sm"
              className="px-2.5"
              onClick={() => {
                const cycle: typeof modView[] = ["normal", "compact", "kanban", "timeline", "gallery"];
                const next = cycle[(cycle.indexOf(modView) + 1) % cycle.length];
                setModView(next); localStorage.setItem("bv-mod-view", next);
              }}
              title={`View: ${modView} — click to cycle`}
            >
              {modView === "normal" ? <LayoutList className="w-4 h-4" /> :
               modView === "compact" ? <Kanban className="w-4 h-4" /> :
               modView === "kanban" ? <Grid2X2 className="w-4 h-4" /> :
               modView === "timeline" ? <CalendarDays className="w-4 h-4" /> :
               <Images className="w-4 h-4" />}
            </Button>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCsvImportOpen(true)}>
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Import CSV
              </Button>
              <Button onClick={() => setAddModOpen(true)} className="bg-theme hover:brightness-90 gap-2">
                <Plus className="w-4 h-4" />
                Add Modification
              </Button>
            </div>
          </div>

          {/* Kanban view */}
          {modView === "kanban" && (
            <KanbanView mods={filteredMods} onStatusChange={cycleModStatus} />
          )}

          {/* Timeline view */}
          {modView === "timeline" && (() => {
            const withDate = [...filteredMods]
              .filter((m) => m.installDate)
              .sort((a, b) => new Date(a.installDate!).getTime() - new Date(b.installDate!).getTime());
            const noDate = filteredMods.filter((m) => !m.installDate);
            const all = [...withDate, ...noDate];
            if (all.length === 0) return (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center py-12 text-center">
                  <CalendarDays className="w-10 h-10 text-muted-foreground/40 mb-3" />
                  <p className="font-medium mb-1">No modifications yet</p>
                  <Button onClick={() => setAddModOpen(true)} size="sm" className="bg-theme hover:brightness-90 mt-2">
                    <Plus className="w-4 h-4 mr-1" /> Add First Mod
                  </Button>
                </CardContent>
              </Card>
            );
            return (
              <div className="relative pl-8">
                <div className="absolute left-3.5 top-2 bottom-2 w-px bg-border" />
                {all.map((mod, i) => {
                  const isNoDate = !mod.installDate;
                  const showNodateDivider = isNoDate && (i === 0 || filteredMods[i - 1]?.installDate);
                  return (
                    <div key={mod.id}>
                      {showNodateDivider && withDate.length > 0 && (
                        <div className="flex items-center gap-2 mb-3 mt-4">
                          <div className="absolute left-0 w-7 h-px bg-border" />
                          <span className="text-xs text-muted-foreground/60 uppercase tracking-widest ml-0">No install date</span>
                        </div>
                      )}
                      <div className="relative mb-4">
                        <div className={`absolute -left-4.5 top-3.5 w-3 h-3 rounded-full border-2 ${
                          mod.status === "INSTALLED" ? "bg-green-400 border-green-400" :
                          mod.status === "REMOVED" ? "bg-red-400 border-red-400" :
                          "bg-background border-theme"
                        }`} style={{ left: "-1.35rem" }} />
                        {mod.installDate && (
                          <p className="text-xs text-muted-foreground mb-1">{formatDate(mod.installDate)}</p>
                        )}
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors group">
                          {mod.imageUrl && (
                            <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={mod.imageUrl} alt={mod.name} className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{mod.name}</p>
                            <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                              <span className={`px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[mod.status] || STATUS_COLORS.PLANNED}`}>
                                {mod.status.charAt(0) + mod.status.slice(1).toLowerCase()}
                              </span>
                              {mod.category && <span>{mod.category}</span>}
                              {(mod.actualPrice ?? mod.price) != null && (
                                <span className="font-semibold text-foreground">{formatCurrency((mod.actualPrice ?? mod.price) ?? 0)}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditMod(mod)}><Edit2 className="w-3 h-3" /></Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:text-destructive" onClick={() => deleteMod(mod.id)}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Gallery view */}
          {modView === "gallery" && (() => {
            const withPhoto = filteredMods.filter((m) => m.imageUrl);
            if (withPhoto.length === 0) return (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center py-12 text-center">
                  <Images className="w-10 h-10 text-muted-foreground/40 mb-3" />
                  <p className="font-medium mb-1">No mod photos yet</p>
                  <p className="text-sm text-muted-foreground">Add a product link or image URL to a mod to see photos here.</p>
                </CardContent>
              </Card>
            );
            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {withPhoto.map((mod) => (
                  <button
                    key={mod.id}
                    className="group relative aspect-square rounded-xl overflow-hidden bg-secondary hover:ring-2 hover:ring-theme transition-all"
                    onClick={() => setLightboxMod(mod)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mod.imageUrl!} alt={mod.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                      <p className="text-white text-xs font-medium text-left line-clamp-2">{mod.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            );
          })()}

          {/* Mod list (hidden in kanban/timeline/gallery) */}
          {(modView === "normal" || modView === "compact") && (sortedMods.length === 0 ? (
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
          ) : modSort !== "date" ? (
            <div className={modView === "compact" ? "space-y-1" : "space-y-2"}>
              {sortedMods.map((mod) => renderModCard(mod))}
            </div>
          ) : (
            Object.entries(modsByCategory).map(([category, mods]) => {
              const categoryTotal = mods.reduce((s, m) => s + ((m.actualPrice ?? m.price) ?? 0), 0);
              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{category}</h3>
                    <div className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{mods.length}</div>
                    {categoryTotal > 0 && <span className="text-xs font-semibold text-theme">{formatCurrency(categoryTotal)}</span>}
                    <div className="flex-1 h-px bg-border ml-2" />
                  </div>
                  <div className={modView === "compact" ? "space-y-1" : "space-y-2"}>
                    {mods.map((mod) => renderModCard(mod))}
                  </div>
                </div>
              );
            })
          ))}
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

        {/* ===== LINKS TAB ===== */}
        <TabsContent value="links" className="mt-4">
          <LinksTab vehicleId={id} />
        </TabsContent>

        {/* ===== FILES TAB ===== */}
        <TabsContent value="files" className="mt-4">
          <VehicleFilesTab vehicleId={id} />
        </TabsContent>

        {/* ===== DYNO TAB ===== */}
        <TabsContent value="dyno" className="mt-4">
          <DynoTab vehicleId={id} />
        </TabsContent>

        {/* ===== TUNE LOGS TAB ===== */}
        <TabsContent value="tunelogs" className="mt-4">
          <TuneLogsTab vehicleId={id} />
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
      <PDFExportDialog
        open={pdfDialogOpen}
        onOpenChange={setPdfDialogOpen}
        vehicle={vehicle}
      />
      <CSVImportDialog
        open={csvImportOpen}
        onOpenChange={setCsvImportOpen}
        vehicleId={id}
        onImported={() => { setCsvImportOpen(false); load(); }}
      />

      {/* Recall Dialog */}
      {recallOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setRecallOpen(false)}>
          <div className="bg-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-theme" />
                <h3 className="font-semibold">NHTSA Recall Check</h3>
                <span className="text-xs text-muted-foreground">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </span>
              </div>
              <button onClick={() => setRecallOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {recallLoading ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  <div className="w-5 h-5 border-2 border-theme border-t-transparent rounded-full animate-spin mr-3" />
                  Checking NHTSA database…
                </div>
              ) : recalls === null || recalls.length === 0 ? (
                <div className="text-center py-12">
                  <ShieldAlert className="w-10 h-10 text-green-400 mx-auto mb-3" />
                  <p className="font-semibold text-green-400">No open recalls found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    NHTSA has no recalls on record for this vehicle.
                  </p>
                  <a
                    href={`https://www.nhtsa.gov/vehicle/safety-issues/recalls#recalls`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-theme hover:underline mt-3"
                  >
                    <ExternalLink className="w-3 h-3" /> Check NHTSA directly
                  </a>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-amber-400 font-medium mb-3">
                    {recalls.length} recall{recalls.length !== 1 ? "s" : ""} found
                  </p>
                  {recalls.map((r) => (
                    <div key={r.campaignNumber} className="border border-amber-500/30 bg-amber-500/8 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <p className="font-semibold text-sm">{r.component}</p>
                          <p className="text-xs text-muted-foreground">Campaign #{r.campaignNumber}</p>
                        </div>
                        <a
                          href={r.nhtsaUrl}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-theme hover:underline flex-shrink-0"
                        >
                          NHTSA <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      {r.summary && <p className="text-xs text-muted-foreground mb-1"><span className="font-medium text-foreground">Summary: </span>{r.summary}</p>}
                      {r.consequence && <p className="text-xs text-muted-foreground mb-1"><span className="font-medium text-foreground">Risk: </span>{r.consequence}</p>}
                      {r.remedy && <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Remedy: </span>{r.remedy}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-border flex-shrink-0">
              <p className="text-xs text-muted-foreground">Data from <a href="https://api.nhtsa.gov" target="_blank" rel="noopener noreferrer" className="text-theme hover:underline">NHTSA.gov</a> · Make/model based lookup — for VIN-specific results visit nhtsa.gov directly.</p>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxMod && (() => {
        const modsWithPhoto = vehicle.modifications.filter((m) => m.imageUrl);
        const idx = modsWithPhoto.findIndex((m) => m.id === lightboxMod.id);
        const prev = idx > 0 ? modsWithPhoto[idx - 1] : null;
        const next = idx < modsWithPhoto.length - 1 ? modsWithPhoto[idx + 1] : null;
        return (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setLightboxMod(null)}>
            <button className="absolute top-4 right-4 text-white/60 hover:text-white" onClick={() => setLightboxMod(null)}>
              <X className="w-7 h-7" />
            </button>
            {prev && (
              <button className="absolute left-4 text-white/60 hover:text-white" onClick={(e) => { e.stopPropagation(); setLightboxMod(prev); }}>
                <ChevronLeft className="w-9 h-9" />
              </button>
            )}
            {next && (
              <button className="absolute right-4 text-white/60 hover:text-white" onClick={(e) => { e.stopPropagation(); setLightboxMod(next); }}>
                <ChevronRight className="w-9 h-9" />
              </button>
            )}
            <div className="max-w-3xl max-h-[80vh] flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lightboxMod.imageUrl!} alt={lightboxMod.name} className="max-h-[65vh] max-w-full object-contain rounded-xl" />
              <div className="text-center">
                <p className="text-white font-semibold">{lightboxMod.name}</p>
                <div className="flex items-center justify-center gap-3 mt-1 text-sm text-white/60">
                  {lightboxMod.category && <span>{lightboxMod.category}</span>}
                  {(lightboxMod.actualPrice ?? lightboxMod.price) != null && (
                    <span>{formatCurrency((lightboxMod.actualPrice ?? lightboxMod.price) ?? 0)}</span>
                  )}
                  <span className={`px-1.5 py-0.5 rounded-full border text-xs ${STATUS_COLORS[lightboxMod.status] || STATUS_COLORS.PLANNED}`}>
                    {lightboxMod.status.charAt(0) + lightboxMod.status.slice(1).toLowerCase()}
                  </span>
                </div>
                <p className="text-white/40 text-xs mt-1">{idx + 1} / {modsWithPhoto.length}</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Build Card Dialog */}
      {buildCardOpen && (() => {
        const installed = vehicle.modifications.filter((m) => m.status === "INSTALLED");
        const topMods = [...installed].sort((a, b) => ((b.actualPrice ?? b.price) ?? 0) - ((a.actualPrice ?? a.price) ?? 0)).slice(0, 6);
        const vehicleLabel = vehicle.name || `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
        return (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setBuildCardOpen(false)}>
            <div className="bg-card rounded-2xl overflow-hidden shadow-2xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center px-5 pt-4 pb-0">
                <p className="text-xs text-muted-foreground">BuildVerse · Build Card</p>
                <button onClick={() => setBuildCardOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Card content */}
              <div id="build-card" className="p-5">
                {/* Header */}
                <div className="flex items-start gap-4 mb-5">
                  {vehicle.photoUrl && !bcImgError ? (
                    // Use img (not Next/Image) so data: URIs and all URL types work in Electron
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={vehicle.photoUrl}
                      alt={vehicleLabel}
                      className="w-24 h-24 rounded-xl object-cover flex-shrink-0 bg-secondary"
                      onError={() => setBcImgError(true)}
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                      <Car className="w-10 h-10 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold leading-tight">{vehicleLabel}</h2>
                    {vehicle.name && <p className="text-sm text-muted-foreground">{vehicle.year} {vehicle.make} {vehicle.model}</p>}
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {vehicle.trim && <Badge variant="outline" className="text-xs">{vehicle.trim}</Badge>}
                      {vehicle.platform && <Badge className="text-xs bg-theme/10 text-theme border-theme/20">{vehicle.platform}</Badge>}
                    </div>
                    {(vehicle.instagramUrl || vehicle.facebookUrl) && (
                      <div className="flex gap-3 mt-2">
                        {vehicle.instagramUrl && (
                          <span className="text-xs text-pink-400 flex items-center gap-1">
                            <Instagram className="w-3 h-3" />
                            {vehicle.instagramUrl.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "@").replace(/\/$/, "")}
                          </span>
                        )}
                        {vehicle.facebookUrl && (
                          <span className="text-xs text-blue-400 flex items-center gap-1">
                            <Facebook className="w-3 h-3" />
                            {vehicle.facebookUrl.replace(/^https?:\/\/(www\.)?facebook\.com\//i, "").replace(/\/$/, "")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Specs row */}
                {(vehicle.engine || vehicle.transmission || vehicle.drivetrain) && (
                  <div className="flex flex-wrap gap-4 text-sm mb-4 pb-4 border-b border-border">
                    {vehicle.engine && <div><p className="text-xs text-muted-foreground">Engine</p><p className="font-medium">{vehicle.engine}</p></div>}
                    {vehicle.transmission && <div><p className="text-xs text-muted-foreground">Trans</p><p className="font-medium">{vehicle.transmission}</p></div>}
                    {vehicle.drivetrain && <div><p className="text-xs text-muted-foreground">Drive</p><p className="font-medium">{vehicle.drivetrain}</p></div>}
                    {vehicle.mileage != null && <div><p className="text-xs text-muted-foreground">Miles</p><p className="font-medium">{vehicle.mileage.toLocaleString()}</p></div>}
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-secondary/50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-theme">{completion}%</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Build Complete</p>
                  </div>
                  <div className="bg-secondary/50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-green-400">{installed.length}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Mods Installed</p>
                  </div>
                  <div className="bg-secondary/50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold">{formatCurrency(modValues.installed)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Installed Value</p>
                  </div>
                </div>

                {/* Top mods */}
                {topMods.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Top Mods</p>
                    <div className="space-y-1.5">
                      {topMods.map((mod) => (
                        <div key={mod.id} className="flex items-center gap-2 text-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-theme flex-shrink-0" />
                          <span className="flex-1 font-medium truncate">{mod.name}</span>
                          {(mod.actualPrice ?? mod.price) != null && (
                            <span className="text-muted-foreground flex-shrink-0">{formatCurrency((mod.actualPrice ?? mod.price) ?? 0)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground/40 text-right mt-4">buildverse.app · screenshot to share</p>
              </div>

              <div className="px-5 pb-5 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">Screenshot or download to share your build</p>
                {(window as Window & { electronAPI?: unknown }).electronAPI && (
                  <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={handleDownloadBuildCard}>
                    <Download className="w-3.5 h-3.5" />
                    Download PNG
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
