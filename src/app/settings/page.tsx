"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Database, HardDrive, RefreshCw, Download, Upload,
  Info, Zap, Monitor, Palette, Moon, Sun,
  Archive, RotateCcw, Trash2, ArrowUpCircle,
  CheckCircle2, AlertCircle, Loader2, X, Power, Save, ShoppingBag,
  Tag, Plus, GripVertical,
} from "lucide-react";
import { MOD_CATEGORIES } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { LubeLoggerSettings } from "@/components/integrations/LubeLoggerSettings";
import {
  ACCENT_PRESETS, RADIUS_PRESETS, FONT_PRESETS,
  useCurrentAccent, useCurrentRadius, useCurrentFont, useCurrentScheme,
} from "@/components/ThemeProvider";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Stats { vehicleCount: number; modCount: number; productCount: number; }
interface VehicleItem { _count: { modifications: number } }
interface AppInfo { version: string; userDataPath: string; dbPath: string; isDev: boolean; }
interface BackupEntry { name: string; filePath: string; size: number; createdAt: string; }
type UpdateStatus =
  | { status: "idle" } | { status: "checking" } | { status: "current" }
  | { status: "available"; version: string }
  | { status: "downloading"; percent: number }
  | { status: "downloaded"; version: string }
  | { status: "error" };

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean; platform: string;
      getAppInfo: () => Promise<AppInfo>;
      prefs: { get: () => Promise<Record<string,unknown>>; set: (o: Record<string,unknown>) => Promise<void>; };
      backup: { create: () => Promise<{success:boolean;filePath:string}>; list: () => Promise<BackupEntry[]>; restore: (f:string) => Promise<{success:boolean}>; delete: (f:string) => Promise<{success:boolean}>; };
      update:  { check: () => Promise<void>; install: () => Promise<void>; onStatus: (cb: (s:UpdateStatus) => void) => () => void; };
    };
  }
}

function fmtBytes(b: number) { return b < 1048576 ? `${(b/1024).toFixed(0)} KB` : `${(b/1048576).toFixed(1)} MB`; }
function fmtBackupDate(name: string) {
  const m = name.match(/buildverse-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/);
  return m ? `${m[1]} at ${m[2]}:${m[3]}` : name.replace(/\.db$/, "");
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, action }: {
  title: string; icon: React.ElementType; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-theme/10 flex items-center justify-center">
            <Icon className="w-3.5 h-3.5 text-theme" strokeWidth={2.2} />
          </div>
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────
function Row({ label, desc, children, last }: {
  label: string; desc?: string; children?: React.ReactNode; last?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-3", !last && "border-b border-border/60")}>
      <div>
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none",
        on ? "bg-theme" : "bg-secondary border border-border"
      )}
    >
      <span className={cn(
        "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200",
        on ? "translate-x-4" : "translate-x-0.5"
      )} />
    </button>
  );
}

// ── Btn ───────────────────────────────────────────────────────────────────────
function Btn({ children, onClick, disabled, variant = "outline", size = "sm", className }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  variant?: "outline" | "ghost" | "primary" | "danger"; size?: "sm" | "xs"; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
        size === "sm" ? "px-3 py-1.5 text-sm" : "px-2 py-1 text-xs",
        variant === "outline" && "border border-border bg-secondary hover:bg-accent text-foreground",
        variant === "ghost"   && "text-muted-foreground hover:text-foreground hover:bg-secondary",
        variant === "primary" && "bg-theme text-white hover:brightness-110",
        variant === "danger"  && "text-red-400 hover:text-red-300 hover:bg-red-500/10",
        className
      )}
    >
      {children}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { toast } = useToast();
  const [stats, setStats]       = useState<Stats | null>(null);
  const [appInfo, setAppInfo]   = useState<AppInfo | null>(null);
  const [backups, setBackups]   = useState<BackupEntry[]>([]);
  const [loadingBkp, setLoadingBkp] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: "idle" });
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [closeMode, setCloseModeState] = useState<"background" | "quit">("background");
  const [autoTrackProducts, setAutoTrackProducts] = useState(true);
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const [customCats, setCustomCats] = useState<string[]>([...MOD_CATEGORIES]);
  const [catInput, setCatInput] = useState("");
  const [savingCats, setSavingCats] = useState(false);

  const isElectron = typeof window !== "undefined" && !!window.electronAPI?.isElectron;
  const { accent, setAccent } = useCurrentAccent();
  const { radius, setRadius } = useCurrentRadius();
  const { font, setFont } = useCurrentFont();
  const { scheme, setScheme } = useCurrentScheme();

  const loadStats = useCallback(() => {
    Promise.all([
      fetch("/api/vehicles").then(r => r.json()).catch(() => []),
      fetch("/api/products").then(r => r.json()).catch(() => []),
    ]).then(([vehicles, products]) => {
      const v = Array.isArray(vehicles) ? vehicles as VehicleItem[] : [];
      const p = Array.isArray(products) ? products : [];
      setStats({
        vehicleCount: v.length,
        modCount: v.reduce((s, vh) => s + (vh._count?.modifications ?? 0), 0),
        productCount: p.length,
      });
    });
  }, []);

  const loadBackups = useCallback(async () => {
    if (!isElectron) return;
    setLoadingBkp(true);
    try { setBackups(await window.electronAPI!.backup.list()); } catch {}
    finally { setLoadingBkp(false); }
  }, [isElectron]);

  useEffect(() => {
    // Load auto-track setting from localStorage
    const stored = localStorage.getItem("bv_autoTrackProducts");
    setAutoTrackProducts(stored === null ? true : stored === "true");

    // Compute stats from /api/vehicles
    loadStats();
    if (isElectron) {
      window.electronAPI!.getAppInfo().then(setAppInfo).catch(() => {});
      loadBackups();
      window.electronAPI!.prefs.get().then(p => {
        setCloseModeState((p.closeMode as "background" | "quit") ?? "quit");
      }).catch(() => {});
      const unsub = window.electronAPI!.update.onStatus(setUpdateStatus);
      return unsub;
    }
  }, [isElectron, loadBackups]);

  const saveSettings = async () => {
    // Persist close mode
    if (isElectron) await window.electronAPI!.prefs.set({ closeMode }).catch(() => {});
    // Persist auto-track
    localStorage.setItem("bv_autoTrackProducts", String(autoTrackProducts));
    toast({ title: "Settings saved" });
  };

  const setCloseMode = async (mode: "background" | "quit") => {
    setCloseModeState(mode);
    if (isElectron) await window.electronAPI!.prefs.set({ closeMode: mode });
  };

  const handleExport = async () => {
    try {
      const [vehicles, products] = await Promise.all([
        fetch("/api/vehicles").then(r => r.json()),
        fetch("/api/products").then(r => r.json()),
      ]);
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), version: "1.0", vehicles, products }, null, 2)], { type: "application/json" });
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `buildverse-export-${new Date().toISOString().slice(0,10)}.json` });
      a.click(); URL.revokeObjectURL(a.href);
      toast({ title: "Exported successfully" });
    } catch { toast({ title: "Export failed", variant: "destructive" }); }
  };

  const refreshAll = async () => {
    try {
      const products = await fetch("/api/products").then(r => r.json());
      if (!Array.isArray(products) || !products.length) { toast({ title: "No products to refresh" }); return; }
      toast({ title: `Refreshing ${products.length} products…` });
      await Promise.all(products.map((p: { id: string }) => fetch(`/api/products/${p.id}/refresh`, { method: "POST" })));
      toast({ title: "All products refreshed!" });
    } catch { toast({ title: "Refresh failed", variant: "destructive" }); }
  };

  const removeSampleData = async () => {
    if (!confirm("Remove all Example S2000 sample data? Your own vehicles won't be affected.")) return;
    try {
      const res = await fetch("/api/remove-sample-data", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.removed === 0) {
        toast({ title: "No sample data found", description: "Nothing was removed." });
      } else {
        toast({ title: "Sample data removed" });
        loadStats();
      }
    } catch { toast({ title: "Failed to remove sample data", variant: "destructive" }); }
  };

  useEffect(() => {
    fetch("/api/settings/categories")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.categories)) setCustomCats(d.categories); })
      .catch(() => {});
  }, []);

  const saveCats = async () => {
    setSavingCats(true);
    try {
      await fetch("/api/settings/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: customCats }),
      });
      toast({ title: "Categories saved" });
    } catch { toast({ title: "Failed to save categories", variant: "destructive" }); }
    finally { setSavingCats(false); }
  };

  const resetCats = async () => {
    await fetch("/api/settings/categories", { method: "DELETE" }).catch(() => {});
    setCustomCats([...MOD_CATEGORIES]);
    toast({ title: "Categories reset to defaults" });
  };

  const wipeAllData = async () => {
    if (!confirm("⚠️ This will permanently delete ALL vehicles, modifications, maintenance logs, and budget data. This cannot be undone. Continue?")) return;
    if (!confirm("Are you absolutely sure? All your data will be lost.")) return;
    try {
      const res = await fetch("/api/wipe", { method: "POST" });
      if (!res.ok) throw new Error("Wipe failed");
      setStats({ vehicleCount: 0, modCount: 0, productCount: 0 });
      toast({ title: "All data wiped. Starting fresh!" });
    } catch { toast({ title: "Wipe failed", variant: "destructive" }); }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.vehicles && !data.products) throw new Error("Invalid export file");

      let vehiclesImported = 0, modsImported = 0, logsImported = 0, productsImported = 0;

      // Import vehicles + their nested data
      for (const v of (data.vehicles ?? [])) {
        const { modifications, maintenanceLogs, budgets, _count, ...vehicleData } = v;
        const res = await fetch("/api/vehicles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: vehicleData.name,
            year: vehicleData.year,
            make: vehicleData.make,
            model: vehicleData.model,
            trim: vehicleData.trim,
            engine: vehicleData.engine,
            transmission: vehicleData.transmission,
            drivetrain: vehicleData.drivetrain,
            vin: vehicleData.vin,
            mileage: vehicleData.mileage,
            platform: vehicleData.platform,
            color: vehicleData.color,
            photoUrl: vehicleData.photoUrl,
            notes: vehicleData.notes,
          }),
        });
        if (!res.ok) continue;
        const newVehicle = await res.json();
        vehiclesImported++;

        // Modifications
        for (const m of (modifications ?? [])) {
          const modRes = await fetch(`/api/vehicles/${newVehicle.id}/modifications`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: m.name, category: m.category, brand: m.brand, vendor: m.vendor,
              price: m.price, actualPrice: m.actualPrice, status: m.status,
              priority: m.priority, difficulty: m.difficulty, link: m.link,
              imageUrl: m.imageUrl, notes: m.notes, partNumber: m.partNumber,
              orderNumber: m.orderNumber, installDate: m.installDate,
              installMileage: m.installMileage, laborCost: m.laborCost,
              diyInstall: m.diyInstall,
            }),
          });
          if (modRes.ok) modsImported++;
        }

        // Maintenance logs
        for (const log of (maintenanceLogs ?? [])) {
          const logRes = await fetch(`/api/vehicles/${newVehicle.id}/maintenance`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              service: log.service, mileage: log.mileage, date: log.date,
              cost: log.cost, notes: log.notes, shop: log.shop,
              diy: log.diy, nextDue: log.nextDue, nextMiles: log.nextMiles,
            }),
          });
          if (logRes.ok) logsImported++;
        }

        // Budgets
        for (const b of (budgets ?? [])) {
          await fetch(`/api/vehicles/${newVehicle.id}/budget`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category: b.category, planned: b.planned, actual: b.actual }),
          });
        }
      }

      // Import products
      for (const p of (data.products ?? [])) {
        const prodRes = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: p.url }),
        });
        if (prodRes.ok) productsImported++;
      }

      // Refresh stats
      const [newVehicles, newProducts] = await Promise.all([
        fetch("/api/vehicles").then(r => r.json()).catch(() => []),
        fetch("/api/products").then(r => r.json()).catch(() => []),
      ]);
      const vList = Array.isArray(newVehicles) ? newVehicles as VehicleItem[] : [];
      const pList = Array.isArray(newProducts) ? newProducts : [];
      setStats({ vehicleCount: vList.length, modCount: vList.reduce((s, vh) => s + (vh._count?.modifications ?? 0), 0), productCount: pList.length });

      toast({ title: `Import complete — ${vehiclesImported} vehicles, ${modsImported} mods, ${logsImported} logs, ${productsImported} products` });
    } catch (err) {
      toast({ title: `Import failed: ${err instanceof Error ? err.message : "Unknown error"}`, variant: "destructive" });
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = "";
    }
  };

  const createBackup = async () => {
    setLoadingBkp(true);
    try { await window.electronAPI!.backup.create(); await loadBackups(); toast({ title: "Backup created" }); }
    catch { toast({ title: "Backup failed", variant: "destructive" }); setLoadingBkp(false); }
  };

  const restoreBackup = async (filePath: string) => {
    setConfirmRestore(null);
    toast({ title: "Restoring — app will restart…" });
    try { await window.electronAPI!.backup.restore(filePath); }
    catch { toast({ title: "Restore failed", variant: "destructive" }); }
  };

  const deleteBackup = async (filePath: string) => {
    try {
      await window.electronAPI!.backup.delete(filePath);
      setBackups(p => p.filter(b => b.filePath !== filePath));
      toast({ title: "Backup deleted" });
    } catch { toast({ title: "Delete failed", variant: "destructive" }); }
  };

  return (
    <div className="max-w-2xl space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Appearance, behavior, backups &amp; data</p>
      </div>

      {/* ── Appearance ──────────────────────────────────────────────────────── */}
      <Section title="Appearance" icon={Palette}>
        {/* Dark / Light mode */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Color Mode</p>
          <div className="flex gap-2">
            <button
              onClick={() => setScheme("dark")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium border rounded-xl transition-all duration-150",
                scheme === "dark"
                  ? "border-theme bg-theme/10 text-theme"
                  : "border-border bg-secondary text-muted-foreground hover:text-foreground hover:border-border/80"
              )}
            >
              <Moon className="w-4 h-4" /> Dark
            </button>
            <button
              onClick={() => setScheme("light")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium border rounded-xl transition-all duration-150",
                scheme === "light"
                  ? "border-theme bg-theme/10 text-theme"
                  : "border-border bg-secondary text-muted-foreground hover:text-foreground hover:border-border/80"
              )}
            >
              <Sun className="w-4 h-4" /> Light
            </button>
          </div>
        </div>

        {/* Accent color */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Accent color</p>
          <div className="flex flex-wrap gap-2">
            {ACCENT_PRESETS.map(p => (
              <button
                key={p.id}
                title={p.label}
                onClick={() => setAccent(p.id)}
                className={cn(
                  "w-8 h-8 rounded-full border-2 transition-all duration-150 relative",
                  accent === p.id
                    ? "border-white scale-110 shadow-lg"
                    : "border-transparent hover:scale-105 hover:border-white/40"
                )}
                style={{ backgroundColor: p.hex }}
              >
                {accent === p.id && (
                  <CheckCircle2 className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow" />
                )}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2 capitalize">{ACCENT_PRESETS.find(p => p.id === accent)?.label ?? accent}</p>
        </div>

        {/* Font */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Font</p>
          <div className="grid grid-cols-2 gap-2">
            {FONT_PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => setFont(p.id)}
                className={cn(
                  "py-2 text-sm font-medium border rounded-xl transition-all duration-150",
                  font === p.id
                    ? "border-theme bg-theme/10 text-theme"
                    : "border-border bg-secondary text-muted-foreground hover:border-border/80 hover:text-foreground"
                )}
                style={{ fontFamily: p.value }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Border radius */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Corner radius</p>
          <div className="flex gap-2">
            {RADIUS_PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => setRadius(p.id)}
                className={cn(
                  "flex-1 py-2 text-xs font-medium border transition-all duration-150",
                  p.id === "sharp"   && "rounded-sm",
                  p.id === "default" && "rounded-lg",
                  p.id === "rounded" && "rounded-xl",
                  p.id === "pill"    && "rounded-full",
                  radius === p.id
                    ? "border-theme bg-theme/10 text-theme"
                    : "border-border bg-secondary text-muted-foreground hover:border-border/80 hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Custom Mod Categories ───────────────────────────────────────────── */}
      <Section
        title="Mod Categories"
        icon={Tag}
        action={
          <div className="flex gap-2">
            <Btn size="xs" onClick={resetCats}>Reset to defaults</Btn>
            <Btn size="xs" variant="primary" onClick={saveCats} disabled={savingCats}>
              {savingCats ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Save
            </Btn>
          </div>
        }
      >
        <p className="text-xs text-muted-foreground mb-3">Add, remove, or reorder mod categories. Changes apply to the add-mod form and filters.</p>
        <div className="space-y-1.5 mb-3 max-h-64 overflow-y-auto pr-1">
          {customCats.map((cat, i) => (
            <div key={i} className="flex items-center gap-2 group px-2 py-1 rounded-lg hover:bg-secondary/50">
              <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
              <span className="flex-1 text-sm">{cat}</span>
              <button
                onClick={() => setCustomCats((cs) => cs.filter((_, j) => j !== i))}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="New category name…"
            value={catInput}
            onChange={(e) => setCatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && catInput.trim()) {
                setCustomCats((cs) => [...cs, catInput.trim()]);
                setCatInput("");
              }
            }}
            className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Btn
            size="sm"
            onClick={() => {
              if (catInput.trim()) { setCustomCats((cs) => [...cs, catInput.trim()]); setCatInput(""); }
            }}
            disabled={!catInput.trim()}
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </Btn>
        </div>
      </Section>

      {/* ── Window behavior (Electron only) ─────────────────────────────────── */}
      {isElectron && (
        <Section title="Window Behavior" icon={Monitor}>
          <Row
            label="Run in background when closed"
            desc='When you click ✕ the app stays running in the system tray. Turn off to fully quit.'
            last
          >
            <Toggle on={closeMode === "background"} onChange={v => setCloseMode(v ? "background" : "quit")} />
          </Row>
        </Section>
      )}

      {/* ── About ───────────────────────────────────────────────────────────── */}
      <Section title="About BuildVerse" icon={Zap}>
        <Row label="Version">
          <span className="text-xs font-mono bg-secondary border border-border px-2 py-1 rounded-md">
            v{appInfo?.version ?? "1.0.9"}
          </span>
        </Row>
        <Row label="Stack">
          <span className="text-sm text-muted-foreground">Next.js 14 · Prisma · SQLite</span>
        </Row>
        <Row label="Running in">
          {isElectron
            ? <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-theme/10 text-theme border border-theme/20 px-2 py-1 rounded-lg"><Monitor className="w-3 h-3" /> Electron</span>
            : <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 rounded-lg">Browser</span>
          }
        </Row>
        <Row label="Mode" last>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-1 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Local / Offline
          </span>
        </Row>
      </Section>

      {/* ── Updates ─────────────────────────────────────────────────────────── */}
      {isElectron && (
        <Section
          title="Updates"
          icon={ArrowUpCircle}
          action={
            updateStatus.status !== "downloading" && updateStatus.status !== "downloaded" ? (
              <Btn onClick={() => { setUpdateStatus({ status: "checking" }); window.electronAPI!.update.check(); }} disabled={updateStatus.status === "checking"}>
                <RefreshCw className={cn("w-3.5 h-3.5", updateStatus.status === "checking" && "animate-spin")} />
                Check
              </Btn>
            ) : updateStatus.status === "downloaded" ? (
              <Btn variant="primary" onClick={() => window.electronAPI!.update.install()}>
                <ArrowUpCircle className="w-3.5 h-3.5" /> Restart &amp; Install
              </Btn>
            ) : null
          }
        >
          <div className="flex items-center gap-2.5 text-sm">
            {(updateStatus.status === "idle" || updateStatus.status === "current") && <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />}
            {(updateStatus.status === "checking" || updateStatus.status === "downloading") && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />}
            {(updateStatus.status === "available" || updateStatus.status === "downloaded") && <ArrowUpCircle className="w-4 h-4 text-theme shrink-0" />}
            {updateStatus.status === "error" && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
            <span className="text-muted-foreground">
              {updateStatus.status === "idle"        && "Click 'Check' to look for updates"}
              {updateStatus.status === "checking"    && "Checking for updates…"}
              {updateStatus.status === "current"     && "BuildVerse is up to date"}
              {updateStatus.status === "available"   && `v${(updateStatus as {status:"available";version:string}).version} available — downloading…`}
              {updateStatus.status === "downloading" && `Downloading… ${(updateStatus as {status:"downloading";percent:number}).percent}%`}
              {updateStatus.status === "downloaded"  && `v${(updateStatus as {status:"downloaded";version:string}).version} ready — restart to install`}
              {updateStatus.status === "error"       && "Update check failed"}
            </span>
          </div>
          {updateStatus.status === "downloading" && (
            <div className="mt-3 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-theme rounded-full transition-all duration-300"
                style={{ width: `${(updateStatus as {status:"downloading";percent:number}).percent}%` }} />
            </div>
          )}
        </Section>
      )}

      {/* ── Database Overview ────────────────────────────────────────────────── */}
      {stats && (
        <Section title="Database" icon={Database}>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Vehicles",      value: stats.vehicleCount },
              { label: "Modifications", value: stats.modCount },
              { label: "Products",      value: stats.productCount },
            ].map(({ label, value }) => (
              <div key={label} className="surface-inset p-4 text-center">
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Product Tracking ─────────────────────────────────────────────────── */}
      <Section title="Product Tracking" icon={ShoppingBag}>
        <Row
          label="Auto-track mod product links"
          desc="When you add or edit a mod with a product URL, automatically add it to Product Tracker."
          last
        >
          <Toggle on={autoTrackProducts} onChange={setAutoTrackProducts} />
        </Row>
      </Section>

      {/* ── Integrations ─────────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 px-1">Integrations</p>
        <LubeLoggerSettings />
      </div>

      {/* ── Data Management ──────────────────────────────────────────────────── */}
      <Section title="Data Management" icon={HardDrive}>
        <Row label="Export Data" desc="Download all vehicles, mods & products as JSON">
          <Btn onClick={handleExport}><Download className="w-3.5 h-3.5" /> Export</Btn>
        </Row>
        <Row label="Import Data" desc="Restore from a BuildVerse JSON export file">
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          <Btn onClick={() => importRef.current?.click()} disabled={importing}>
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {importing ? "Importing…" : "Import"}
          </Btn>
        </Row>
        <Row label="Refresh Product Prices" desc="Re-scrape all tracked product URLs">
          <Btn onClick={refreshAll}><RefreshCw className="w-3.5 h-3.5" /> Refresh All</Btn>
        </Row>
        <Row label="Remove Example Data" desc="Delete the Example S2000 sample vehicle and all its mods/maintenance. Your own data is untouched.">
          <Btn onClick={removeSampleData}><Trash2 className="w-3.5 h-3.5" /> Remove</Btn>
        </Row>
        <Row label="Wipe All Data" desc="Delete every vehicle, mod, maintenance log and product. Cannot be undone." last>
          <Btn variant="danger" onClick={wipeAllData}><Trash2 className="w-3.5 h-3.5" /> Wipe Everything</Btn>
        </Row>
      </Section>

      {/* ── Backups ──────────────────────────────────────────────────────────── */}
      {isElectron && (
        <Section
          title="Backups"
          icon={Archive}
          action={
            <Btn onClick={createBackup} disabled={loadingBkp}>
              {loadingBkp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
              New Backup
            </Btn>
          }
        >
          <p className="text-xs text-muted-foreground mb-3">
            Auto-backup on startup · 10 most recent kept
            {appInfo && <span className="font-mono ml-2 opacity-60">{appInfo.userDataPath}/backups</span>}
          </p>

          {loadingBkp ? (
            <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : backups.length === 0 ? (
            <p className="text-sm text-muted-foreground py-1">No backups yet — one will be created on next launch.</p>
          ) : (
            <div className="space-y-1">
              {backups.map(b => (
                <div key={b.filePath} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-secondary transition-colors">
                  {confirmRestore === b.filePath ? (
                    <>
                      <p className="text-sm font-medium text-theme">Restore this? App will restart.</p>
                      <div className="flex gap-2">
                        <Btn size="xs" onClick={() => setConfirmRestore(null)}>Cancel</Btn>
                        <Btn size="xs" variant="primary" onClick={() => restoreBackup(b.filePath)}>Confirm</Btn>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{fmtBackupDate(b.name)}</p>
                        <p className="text-xs text-muted-foreground">{fmtBytes(b.size)}</p>
                      </div>
                      <div className="flex gap-1 ml-4">
                        <Btn size="xs" onClick={() => setConfirmRestore(b.filePath)}>
                          <RotateCcw className="w-3 h-3" /> Restore
                        </Btn>
                        <Btn size="xs" variant="danger" onClick={() => deleteBackup(b.filePath)}>
                          <Trash2 className="w-3 h-3" />
                        </Btn>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      <p className="text-xs text-center text-muted-foreground/50">
        All data is stored locally — no cloud, no accounts
      </p>

      {/* ── Sticky Save Button ───────────────────────────────────────────────── */}
      <div className="sticky bottom-0 pb-4 pt-2 bg-background/80 backdrop-blur border-t border-border/40 flex justify-end">
        <button
          onClick={saveSettings}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-theme text-white font-medium text-sm hover:brightness-110 transition-all shadow-lg"
        >
          <Save className="w-4 h-4" />
          Save Settings
        </button>
      </div>
    </div>
  );
}
