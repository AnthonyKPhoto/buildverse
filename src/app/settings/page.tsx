"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Database, HardDrive, RefreshCw, Download, Upload,
  Zap, Monitor, Palette, Moon, Sun,
  Archive, RotateCcw, Trash2, ArrowUpCircle,
  CheckCircle2, AlertCircle, Loader2, X, Save, ShoppingBag,
  Tag, Plus, GripVertical, Globe, Lock, Eye, EyeOff,
  Shield, Copy, Smartphone, Plug, Key, Cloud,
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
interface RemoteConfig { enabled: boolean; domain: string; port: number; hasPassword: boolean; }
type Section = "general" | "remote" | "integrations" | "data" | "sync";
type SyncMethod = "server" | "webdav" | "gdrive";
type UpdateStatus =
  | { status: "idle" } | { status: "checking" } | { status: "current" }
  | { status: "available"; version: string; downloadUrl?: string; manual?: boolean }
  | { status: "downloading"; percent: number }
  | { status: "downloaded"; version: string }
  | { status: "error" };

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean; platform: string;
      getAppInfo: () => Promise<AppInfo>;
      prefs: { get: () => Promise<Record<string, unknown>>; set: (o: Record<string, unknown>) => Promise<void>; };
      backup: { create: () => Promise<{ success: boolean; filePath: string }>; list: () => Promise<BackupEntry[]>; restore: (f: string) => Promise<{ success: boolean }>; delete: (f: string) => Promise<{ success: boolean }>; };
      update: { check: () => Promise<void>; install: () => Promise<void>; onStatus: (cb: (s: UpdateStatus) => void) => () => void; };
      network?: {
        getLanUrl: () => Promise<string | null>;
        setLanAccess: (enabled: boolean) => Promise<{ success: boolean; requiresRestart: boolean }>;
        getRemoteConfig: () => Promise<RemoteConfig>;
        setRemoteConfig: (cfg: { enabled: boolean; domain: string; port: number }) => Promise<{ success: boolean; requiresRestart: boolean }>;
        setRemotePassword: (password: string) => Promise<{ success: boolean; requiresRestart: boolean }>;
        clearRemotePassword: () => Promise<{ success: boolean; requiresRestart: boolean }>;
      };
      transfer?: {
        exportZip: () => Promise<{ canceled?: boolean; success?: boolean; filePath?: string; error?: string }>;
        importZip: () => Promise<{ canceled?: boolean; success?: boolean; error?: string }>;
      };
      restart?:      () => Promise<void>;
      openExternal?: (url: string) => Promise<void>;
    };
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function fmtBytes(b: number) { return b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`; }
function fmtBackupDate(name: string) {
  const m = name.match(/buildverse-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/);
  return m ? `${m[1]} at ${m[2]}:${m[3]}` : name.replace(/\.db$/, "");
}

// ── Shared UI primitives ──────────────────────────────────────────────────────
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
        variant === "ghost" && "text-muted-foreground hover:text-foreground hover:bg-secondary",
        variant === "primary" && "bg-theme text-white hover:brightness-110",
        variant === "danger" && "text-red-400 hover:text-red-300 hover:bg-red-500/10",
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

  // Navigation
  const [section, setSection] = useState<Section>("general");

  // General state
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: "idle" });
  const [closeMode, setCloseModeState] = useState<"background" | "quit">("background");
  const [autoTrackProducts, setAutoTrackProducts] = useState(true);
  const [customCats, setCustomCats] = useState<string[]>([...MOD_CATEGORIES]);
  const [catInput, setCatInput] = useState("");
  const [savingCats, setSavingCats] = useState(false);

  // Remote Access state
  const [remoteConfig, setRemoteConfig] = useState<RemoteConfig | null>(null);
  const [remoteEnabled, setRemoteEnabled] = useState(false);
  const [remoteDomain, setRemoteDomain] = useState("");
  const [remotePort, setRemotePort] = useState(3456);
  const [lanUrl, setLanUrl] = useState<string | null>(null);
  const [savingRemote, setSavingRemote] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);
  const [restartNeeded, setRestartNeeded] = useState(false);

  // Mobile Sync state
  const [syncMethod,       setSyncMethodState]  = useState<SyncMethod>("server");
  const [webdavUrl,        setWebdavUrl]         = useState("");
  const [webdavUsername,   setWebdavUsername]    = useState("");
  const [webdavPassword,   setWebdavPassword]    = useState("");
  const [showWebdavPass,   setShowWebdavPass]    = useState(false);
  const [syncingDir,       setSyncingDir]        = useState<"upload"|"download"|null>(null);
  const [gdriveEmail,      setGdriveEmail]       = useState<string | null>(null);
  const [gdriveLastSync,   setGdriveLastSync]    = useState<string | null>(null);
  const [gdriveWaiting,    setGdriveWaiting]     = useState(false);
  const [syncMsg,          setSyncMsg]           = useState<{text:string;type:"info"|"success"|"error"}|null>(null);
  const [lastSyncedAt,     setLastSyncedAt]      = useState<string|null>(null);

  // Data & Backup state
  const [stats, setStats] = useState<Stats | null>(null);
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loadingBkp, setLoadingBkp] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [zipExporting, setZipExporting] = useState(false);
  const [zipImporting, setZipImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

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
      setStats({ vehicleCount: v.length, modCount: v.reduce((s, vh) => s + (vh._count?.modifications ?? 0), 0), productCount: p.length });
    });
  }, []);

  const loadBackups = useCallback(async () => {
    if (!isElectron) return;
    setLoadingBkp(true);
    try { setBackups(await window.electronAPI!.backup.list()); } catch {}
    finally { setLoadingBkp(false); }
  }, [isElectron]);

  // Load sync config + handle OAuth redirect-back params
  useEffect(() => {
    setSyncMethodState((localStorage.getItem("bv_sync_method") as SyncMethod) || "server");
    setWebdavUrl(localStorage.getItem("bv_sync_webdav_url") || "");
    setWebdavUsername(localStorage.getItem("bv_sync_webdav_username") || "");
    setWebdavPassword(localStorage.getItem("bv_sync_webdav_password") || "");
    setLastSyncedAt(localStorage.getItem("bv_sync_last_synced_at"));

    // Handle gdrive OAuth redirect params
    const params = new URLSearchParams(window.location.search);
    if (params.get("gdrive") === "connected") {
      setSyncMethodState("gdrive");
      localStorage.setItem("bv_sync_method", "gdrive");
      window.history.replaceState({}, "", window.location.pathname + "?section=sync");
    }
    if (params.get("gdrive_error")) {
      toast({ title: "Google Drive error", description: decodeURIComponent(params.get("gdrive_error") || ""), variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname + "?section=sync");
    }

    // Load gdrive connection status
    fetch("/api/gdrive").then(r => r.json()).then((s: { connected: boolean; email?: string; lastSync?: string }) => {
      if (s.connected) {
        setGdriveEmail(s.email ?? null);
        setGdriveLastSync(s.lastSync ?? null);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("bv_autoTrackProducts");
    setAutoTrackProducts(stored === null ? true : stored === "true");
    loadStats();
    if (isElectron) {
      window.electronAPI!.getAppInfo().then(setAppInfo).catch(() => {});
      loadBackups();
      window.electronAPI!.prefs.get().then(p => {
        setCloseModeState((p.closeMode as "background" | "quit") ?? "quit");
      }).catch(() => {});
      window.electronAPI!.network?.getLanUrl().then(url => setLanUrl(url)).catch(() => {});
      window.electronAPI!.network?.getRemoteConfig?.().then(cfg => {
        if (cfg) {
          setRemoteConfig(cfg);
          setRemoteEnabled(cfg.enabled);
          setRemoteDomain(cfg.domain || "");
          setRemotePort(cfg.port || 3456);
        }
      }).catch(() => {});
      const unsub = window.electronAPI!.update.onStatus(setUpdateStatus);
      return unsub;
    }
  }, [isElectron, loadBackups, loadStats]);

  useEffect(() => {
    fetch("/api/settings/categories")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.categories)) setCustomCats(d.categories); })
      .catch(() => {});
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const setCloseMode = async (mode: "background" | "quit") => {
    setCloseModeState(mode);
    if (isElectron) await window.electronAPI!.prefs.set({ closeMode: mode });
  };

  const saveCats = async () => {
    setSavingCats(true);
    try {
      await fetch("/api/settings/categories", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categories: customCats }) });
      toast({ title: "Categories saved" });
    } catch { toast({ title: "Failed to save categories", variant: "destructive" }); }
    finally { setSavingCats(false); }
  };

  const resetCats = async () => {
    await fetch("/api/settings/categories", { method: "DELETE" }).catch(() => {});
    setCustomCats([...MOD_CATEGORIES]);
    toast({ title: "Categories reset to defaults" });
  };

  const saveRemoteConfig = async () => {
    if (!isElectron) return;
    setSavingRemote(true);
    try {
      await window.electronAPI!.network?.setRemoteConfig?.({ enabled: remoteEnabled, domain: remoteDomain, port: remotePort || 3456 });
      setRestartNeeded(true);
      toast({ title: "Remote access saved", description: "Restart BuildVerse to apply." });
    } catch { toast({ title: "Failed to save settings", variant: "destructive" }); }
    finally { setSavingRemote(false); }
  };

  const saveRemotePassword = async () => {
    if (!isElectron || !passwordInput) return;
    if (passwordInput !== confirmPasswordInput) { toast({ title: "Passwords don't match", variant: "destructive" }); return; }
    setSettingPassword(true);
    try {
      await window.electronAPI!.network?.setRemotePassword?.(passwordInput);
      setRemoteConfig(c => c ? { ...c, hasPassword: true } : c);
      setPasswordInput("");
      setConfirmPasswordInput("");
      setRestartNeeded(true);
      toast({ title: "Password set", description: "Restart BuildVerse to apply." });
    } catch { toast({ title: "Failed to set password", variant: "destructive" }); }
    finally { setSettingPassword(false); }
  };

  const clearRemotePassword = async () => {
    if (!isElectron) return;
    if (!confirm("Remove the remote access password? Anyone with network access will be able to view your data.")) return;
    try {
      await window.electronAPI!.network?.clearRemotePassword?.();
      setRemoteConfig(c => c ? { ...c, hasPassword: false } : c);
      setRestartNeeded(true);
      toast({ title: "Password removed", description: "Restart BuildVerse to apply." });
    } catch { toast({ title: "Failed to remove password", variant: "destructive" }); }
  };

  const externalUrl = useMemo(() => remoteDomain ? `https://${remoteDomain}` : null, [remoteDomain]);

  const handleExport = async () => {
    try {
      const [vehicles, products] = await Promise.all([fetch("/api/vehicles").then(r => r.json()), fetch("/api/products").then(r => r.json())]);
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), version: "1.0", vehicles, products }, null, 2)], { type: "application/json" });
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `buildverse-export-${new Date().toISOString().slice(0, 10)}.json` });
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
      if (data.removed === 0) toast({ title: "No sample data found", description: "Nothing was removed." });
      else { toast({ title: "Sample data removed" }); loadStats(); }
    } catch { toast({ title: "Failed to remove sample data", variant: "destructive" }); }
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

  const handleExportZip = async () => {
    if (!isElectron) return;
    setZipExporting(true);
    try {
      const result = await window.electronAPI!.transfer?.exportZip();
      if (!result || result.canceled) return;
      if (result.success) toast({ title: "Transfer pack exported!", description: result.filePath });
      else toast({ title: "Export failed", description: result.error, variant: "destructive" });
    } catch { toast({ title: "Export failed", variant: "destructive" }); }
    finally { setZipExporting(false); }
  };

  const handleImportZip = async () => {
    if (!isElectron) return;
    if (!confirm("This will replace your current database with the pack and restart the app. Continue?")) return;
    setZipImporting(true);
    try {
      const result = await window.electronAPI!.transfer?.importZip();
      if (!result || result.canceled) { setZipImporting(false); return; }
      if (!result.success) { toast({ title: "Import failed", description: result.error, variant: "destructive" }); setZipImporting(false); }
    } catch { toast({ title: "Import failed", variant: "destructive" }); setZipImporting(false); }
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
      for (const v of (data.vehicles ?? [])) {
        const { modifications, maintenanceLogs, budgets, _count: _c, ...vehicleData } = v;
        const res = await fetch("/api/vehicles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: vehicleData.name, year: vehicleData.year, make: vehicleData.make, model: vehicleData.model, trim: vehicleData.trim, engine: vehicleData.engine, transmission: vehicleData.transmission, drivetrain: vehicleData.drivetrain, vin: vehicleData.vin, mileage: vehicleData.mileage, platform: vehicleData.platform, color: vehicleData.color, photoUrl: vehicleData.photoUrl, notes: vehicleData.notes }) });
        if (!res.ok) continue;
        const newVehicle = await res.json();
        vehiclesImported++;
        for (const m of (modifications ?? [])) {
          const mr = await fetch(`/api/vehicles/${newVehicle.id}/modifications`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: m.name, category: m.category, brand: m.brand, vendor: m.vendor, price: m.price, actualPrice: m.actualPrice, status: m.status, priority: m.priority, difficulty: m.difficulty, link: m.link, imageUrl: m.imageUrl, notes: m.notes, partNumber: m.partNumber, orderNumber: m.orderNumber, installDate: m.installDate, installMileage: m.installMileage, laborCost: m.laborCost, diyInstall: m.diyInstall }) });
          if (mr.ok) modsImported++;
        }
        for (const log of (maintenanceLogs ?? [])) {
          const lr = await fetch(`/api/vehicles/${newVehicle.id}/maintenance`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ service: log.service, mileage: log.mileage, date: log.date, cost: log.cost, notes: log.notes, shop: log.shop, diy: log.diy, nextDue: log.nextDue, nextMiles: log.nextMiles }) });
          if (lr.ok) logsImported++;
        }
        for (const b of (budgets ?? [])) {
          await fetch(`/api/vehicles/${newVehicle.id}/budget`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: b.category, planned: b.planned, actual: b.actual }) });
        }
      }
      for (const p of (data.products ?? [])) {
        const pr = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: p.url }) });
        if (pr.ok) productsImported++;
      }
      const [nv, np] = await Promise.all([fetch("/api/vehicles").then(r => r.json()).catch(() => []), fetch("/api/products").then(r => r.json()).catch(() => [])]);
      const vl = Array.isArray(nv) ? nv as VehicleItem[] : [];
      const pl = Array.isArray(np) ? np : [];
      setStats({ vehicleCount: vl.length, modCount: vl.reduce((s, vh) => s + (vh._count?.modifications ?? 0), 0), productCount: pl.length });
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

  // ── Mobile Sync handlers ──────────────────────────────────────────────────
  const setSyncMethod = (m: SyncMethod) => {
    setSyncMethodState(m);
    localStorage.setItem("bv_sync_method", m);
  };

  const saveSyncConfig = () => {
    localStorage.setItem("bv_sync_method",          syncMethod);
    localStorage.setItem("bv_sync_webdav_url",      webdavUrl);
    localStorage.setItem("bv_sync_webdav_username", webdavUsername);
    localStorage.setItem("bv_sync_webdav_password", webdavPassword);
    toast({ title: "Sync settings saved" });
  };

  const GDRIVE_CLIENT_ID = "874903401741-bkbf6fjgq04583agk60o1vgi0iv4j34v.apps.googleusercontent.com";

  const handleGdriveConnect = () => {
    const path = `/api/oauth/google/start?client_id=${encodeURIComponent(GDRIVE_CLIENT_ID)}`;
    if (window.electronAPI?.openExternal) {
      const port = window.location.port || "3456";
      window.electronAPI.openExternal(`http://127.0.0.1:${port}${path}`);
      setGdriveWaiting(true);
      const interval = setInterval(async () => {
        try {
          const s = await fetch("/api/gdrive").then(r => r.json()) as { connected: boolean; email?: string; lastSync?: string };
          if (s.connected) {
            setGdriveEmail(s.email ?? null);
            setGdriveLastSync(s.lastSync ?? null);
            setGdriveWaiting(false);
            clearInterval(interval);
            toast({ title: "Google Drive connected!" });
          }
        } catch { /* ignore */ }
      }, 1000);
      setTimeout(() => { clearInterval(interval); setGdriveWaiting(false); }, 5 * 60 * 1000);
    } else {
      window.location.href = path;
    }
  };

  const handleGdriveDisconnect = async () => {
    await fetch("/api/gdrive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "disconnect" }) });
    setGdriveEmail(null);
    setGdriveLastSync(null);
    toast({ title: "Google Drive disconnected" });
  };

  const doSyncUpload = async () => {
    setSyncingDir("upload");
    setSyncMsg(null);
    try {
      if (syncMethod === "gdrive") {
        const res = await fetch("/api/gdrive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "upload" }) });
        const result = await res.json() as { success?: boolean; syncedAt?: string; error?: string };
        if (!res.ok) throw new Error(result.error || "Drive upload failed");
        setGdriveLastSync(result.syncedAt ?? null);
        setSyncMsg({ text: "All data backed up to Google Drive", type: "success" });
        toast({ title: "Backed up to Google Drive" });
        return;
      }

      const snapshot = await fetch("/api/sync").then(r => r.json());

      if (syncMethod === "webdav") {
        const auth = "Basic " + btoa(`${webdavUsername}:${webdavPassword}`);
        const res  = await fetch(webdavUrl.replace(/\/$/, "") + "/buildverse-sync.json", {
          method: "PUT", headers: { Authorization: auth, "Content-Type": "application/json" },
          body:   JSON.stringify(snapshot),
        });
        if (!res.ok) throw new Error("WebDAV error " + res.status);

      } else {
        throw new Error("Server is the source of truth — use Pull on your phone instead");
      }

      const now = new Date().toISOString();
      localStorage.setItem("bv_sync_last_synced_at", now);
      setLastSyncedAt(now);
      setSyncMsg({ text: "Snapshot uploaded successfully", type: "success" });
      toast({ title: "Snapshot uploaded" });
    } catch (e) {
      setSyncMsg({ text: e instanceof Error ? e.message : String(e), type: "error" });
      toast({ title: "Upload failed", variant: "destructive" });
    } finally { setSyncingDir(null); }
  };

  const doSyncDownload = async () => {
    setSyncingDir("download");
    setSyncMsg(null);
    try {
      if (syncMethod === "gdrive") {
        if (!confirm("This will replace all local data with the version saved in Google Drive. Continue?")) {
          setSyncingDir(null);
          return;
        }
        const res = await fetch("/api/gdrive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "download" }) });
        const result = await res.json() as { success?: boolean; imported?: Record<string, number>; syncedAt?: string; error?: string };
        if (!res.ok) throw new Error(result.error || "Drive download failed");
        setGdriveLastSync(result.syncedAt ?? null);
        const c = result.imported ?? {};
        setSyncMsg({ text: `Restored from Drive: ${c.vehicles ?? 0} vehicles, ${c.modifications ?? 0} mods`, type: "success" });
        toast({ title: "Restored from Google Drive" });
        return;
      }

      let snapshot: unknown;

      if (syncMethod === "webdav") {
        const auth = "Basic " + btoa(`${webdavUsername}:${webdavPassword}`);
        const res  = await fetch(webdavUrl.replace(/\/$/, "") + "/buildverse-sync.json", {
          headers: { Authorization: auth },
        });
        if (res.status === 404) throw new Error("No sync file on WebDAV. Push first.");
        if (!res.ok) throw new Error("WebDAV error " + res.status);
        snapshot = await res.json();

      } else {
        throw new Error("Server method: pull changes from the phone using the app, not the desktop");
      }

      // Merge offline queue from snapshot into local DB
      const body = snapshot as { offlineQueue?: unknown[] };
      if (body.offlineQueue?.length) {
        const res = await fetch("/api/sync", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ offlineQueue: body.offlineQueue }),
        });
        const result = await res.json();
        setSyncMsg({ text: `Merged ${result.merged ?? 0} offline change(s) from phone`, type: "success" });
        toast({ title: `Merged ${result.merged ?? 0} offline change(s)` });
      } else {
        setSyncMsg({ text: "No pending offline changes from phone", type: "info" });
        toast({ title: "No pending phone changes" });
      }

      const now = new Date().toISOString();
      localStorage.setItem("bv_sync_last_synced_at", now);
      setLastSyncedAt(now);
    } catch (e) {
      setSyncMsg({ text: e instanceof Error ? e.message : String(e), type: "error" });
      toast({ title: "Download failed", variant: "destructive" });
    } finally { setSyncingDir(null); }
  };

  const NAV_ITEMS: { id: Section; label: string; icon: React.ElementType }[] = [
    { id: "general",      label: "General",       icon: Palette    },
    { id: "remote",       label: "Remote Access", icon: Globe      },
    { id: "sync",         label: "Mobile Sync",   icon: Cloud      },
    { id: "integrations", label: "Integrations",  icon: Plug       },
    { id: "data",         label: "Data & Backup", icon: HardDrive  },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in">
      {/* Hero banner */}
      <div className="-mx-6 -mt-8 mb-8 px-6 pt-8 pb-6 border-b border-border/60 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-theme/5 pointer-events-none" />
        <div className="absolute top-0 right-0 w-72 h-36 bg-theme/8 rounded-full blur-3xl -translate-y-8 translate-x-8 pointer-events-none" />
        <div className="relative">
          <p className="text-xs font-medium text-muted-foreground/60 tracking-wider uppercase mb-1">BuildVerse</p>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Appearance, remote access, integrations &amp; data</p>
        </div>
      </div>

      {/* Restart banner */}
      {restartNeeded && (
        <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Restart BuildVerse to apply remote access changes.</span>
          <div className="ml-auto flex items-center gap-2">
            {window.electronAPI?.restart && (
              <button
                onClick={() => window.electronAPI!.restart!()}
                className="px-2.5 py-1 text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-lg transition-colors"
              >
                Restart Now
              </button>
            )}
            <button onClick={() => setRestartNeeded(false)} className="text-amber-400/60 hover:text-amber-400"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div className="flex gap-6 items-start">

        {/* ── Sidebar ────────────────────────────────────────────────────── */}
        <nav className="w-52 shrink-0 sticky top-0">
          <div className="space-y-0.5">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left",
                  section === item.id ? "bg-theme/10 text-theme" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        {/* ── Content ────────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* ══════════════════════════ GENERAL ══════════════════════════ */}
          {section === "general" && (
            <>
              <Section title="Appearance" icon={Palette}>
                {/* Color mode */}
                <div className="mb-5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Color Mode</p>
                  <div className="flex gap-2">
                    {(["dark", "light"] as const).map(s => (
                      <button key={s} onClick={() => setScheme(s)}
                        className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium border rounded-xl transition-all duration-150",
                          scheme === s ? "border-theme bg-theme/10 text-theme" : "border-border bg-secondary text-muted-foreground hover:text-foreground hover:border-border/80"
                        )}>
                        {s === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                        {s === "dark" ? "Dark" : "Light"}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Accent */}
                <div className="mb-5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Accent color</p>
                  <div className="flex flex-wrap gap-2">
                    {ACCENT_PRESETS.map(p => (
                      <button key={p.id} title={p.label} onClick={() => setAccent(p.id)}
                        className={cn("w-8 h-8 rounded-full border-2 transition-all duration-150 relative",
                          accent === p.id ? "border-white scale-110 shadow-lg" : "border-transparent hover:scale-105 hover:border-white/40"
                        )} style={{ backgroundColor: p.hex }}>
                        {accent === p.id && <CheckCircle2 className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow" />}
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
                      <button key={p.id} onClick={() => setFont(p.id)}
                        className={cn("py-2 text-sm font-medium border rounded-xl transition-all duration-150",
                          font === p.id ? "border-theme bg-theme/10 text-theme" : "border-border bg-secondary text-muted-foreground hover:border-border/80 hover:text-foreground"
                        )} style={{ fontFamily: p.value }}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Radius */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Corner radius</p>
                  <div className="flex gap-2">
                    {RADIUS_PRESETS.map(p => (
                      <button key={p.id} onClick={() => setRadius(p.id)}
                        className={cn("flex-1 py-2 text-xs font-medium border transition-all duration-150",
                          p.id === "sharp" && "rounded-sm", p.id === "default" && "rounded-lg",
                          p.id === "rounded" && "rounded-xl", p.id === "pill" && "rounded-full",
                          radius === p.id ? "border-theme bg-theme/10 text-theme" : "border-border bg-secondary text-muted-foreground hover:border-border/80 hover:text-foreground"
                        )}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </Section>

              <Section title="Mod Categories" icon={Tag}
                action={<div className="flex gap-2">
                  <Btn size="xs" onClick={resetCats}>Reset</Btn>
                  <Btn size="xs" variant="primary" onClick={saveCats} disabled={savingCats}>
                    {savingCats ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                  </Btn>
                </div>}
              >
                <p className="text-xs text-muted-foreground mb-3">Add, remove, or reorder categories used on the add-mod form.</p>
                <div className="space-y-1.5 mb-3 max-h-64 overflow-y-auto pr-1">
                  {customCats.map((cat, i) => (
                    <div key={i} className="flex items-center gap-2 group px-2 py-1 rounded-lg hover:bg-secondary/50">
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                      <span className="flex-1 text-sm">{cat}</span>
                      <button onClick={() => setCustomCats(cs => cs.filter((_, j) => j !== i))} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" placeholder="New category…" value={catInput} onChange={e => setCatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && catInput.trim()) { setCustomCats(cs => [...cs, catInput.trim()]); setCatInput(""); } }}
                    className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <Btn size="sm" onClick={() => { if (catInput.trim()) { setCustomCats(cs => [...cs, catInput.trim()]); setCatInput(""); } }} disabled={!catInput.trim()}>
                    <Plus className="w-3.5 h-3.5" /> Add
                  </Btn>
                </div>
              </Section>

              {isElectron && (
                <Section title="Window Behavior" icon={Monitor}>
                  <Row label="Run in background when closed" desc="Click ✕ keeps the app in the system tray. Turn off to fully quit." last>
                    <Toggle on={closeMode === "background"} onChange={v => setCloseMode(v ? "background" : "quit")} />
                  </Row>
                </Section>
              )}

              <Section title="About BuildVerse" icon={Zap}>
                <Row label="Version">
                  <span className="text-xs font-mono bg-secondary border border-border px-2 py-1 rounded-md">v{appInfo?.version ?? "1.0.9"}</span>
                </Row>
                <Row label="Stack"><span className="text-sm text-muted-foreground">Next.js 14 · Prisma · SQLite</span></Row>
                <Row label="Running in">
                  {isElectron
                    ? <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-theme/10 text-theme border border-theme/20 px-2 py-1 rounded-lg"><Monitor className="w-3 h-3" /> Electron</span>
                    : <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 rounded-lg">Browser</span>
                  }
                </Row>
                <Row label="Mode" last>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-1 rounded-lg">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Local / Offline
                  </span>
                </Row>
              </Section>

              {isElectron && (
                <Section title="Updates" icon={ArrowUpCircle}
                  action={
                    updateStatus.status === "downloaded" ? (
                      <Btn variant="primary" onClick={() => window.electronAPI!.update.install()}>
                        <ArrowUpCircle className="w-3.5 h-3.5" /> Restart &amp; Install
                      </Btn>
                    ) : updateStatus.status === "available" && (updateStatus as { status: "available"; manual?: boolean }).manual ? (
                      <a href={(updateStatus as { status: "available"; downloadUrl?: string }).downloadUrl ?? "#"} target="_blank" rel="noopener noreferrer">
                        <Btn variant="primary"><ArrowUpCircle className="w-3.5 h-3.5" /> Download</Btn>
                      </a>
                    ) : updateStatus.status !== "downloading" ? (
                      <Btn onClick={() => { setUpdateStatus({ status: "checking" }); window.electronAPI!.update.check(); }} disabled={updateStatus.status === "checking"}>
                        <RefreshCw className={cn("w-3.5 h-3.5", updateStatus.status === "checking" && "animate-spin")} /> Check
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
                      {updateStatus.status === "idle" && "Click 'Check' to look for updates"}
                      {updateStatus.status === "checking" && "Checking for updates…"}
                      {updateStatus.status === "current" && "BuildVerse is up to date"}
                      {updateStatus.status === "available" && (() => { const s = updateStatus as { status: "available"; version: string; manual?: boolean }; return s.manual ? `v${s.version} available` : `v${s.version} available — downloading…`; })()}
                      {updateStatus.status === "downloading" && `Downloading… ${(updateStatus as { status: "downloading"; percent: number }).percent}%`}
                      {updateStatus.status === "downloaded" && `v${(updateStatus as { status: "downloaded"; version: string }).version} ready — restart to install`}
                      {updateStatus.status === "error" && "Update check failed"}
                    </span>
                  </div>
                  {updateStatus.status === "downloading" && (
                    <div className="mt-3 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-theme rounded-full transition-all duration-300" style={{ width: `${(updateStatus as { status: "downloading"; percent: number }).percent}%` }} />
                    </div>
                  )}
                </Section>
              )}
            </>
          )}

          {/* ══════════════════════ REMOTE ACCESS ════════════════════════ */}
          {section === "remote" && (
            <>
              {!isElectron && (
                <div className="p-6 rounded-2xl border border-border bg-card text-center text-sm text-muted-foreground">
                  Remote access settings are only available in the Electron desktop app.
                </div>
              )}

              {isElectron && (
                <>
                  <Section title="Remote Access" icon={Globe}>
                    <Row label="Enable Remote Access" desc="Bind the server to all interfaces so it can be reached from other devices or through Traefik">
                      <Toggle on={remoteEnabled} onChange={setRemoteEnabled} />
                    </Row>
                    <div className="pt-4 space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block mb-2">External Domain</label>
                        <input type="text" placeholder="buildverse.yourdomain.com" value={remoteDomain} onChange={e => setRemoteDomain(e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                        <p className="text-xs text-muted-foreground mt-1.5">Your Traefik subdomain pointing to this machine.</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block mb-2">Server Port</label>
                        <input type="number" min={1024} max={65535} value={remotePort} onChange={e => setRemotePort(Number(e.target.value))}
                          className="w-32 px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                        <p className="text-xs text-muted-foreground mt-1.5">Default: 3456.</p>
                      </div>
                    </div>
                    <div className="mt-5 flex items-center justify-between">
                      {window.electronAPI?.restart && restartNeeded ? (
                        <button
                          onClick={() => window.electronAPI!.restart!()}
                          className="px-3 py-1.5 text-sm font-semibold bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 rounded-lg transition-colors"
                        >
                          Restart Now
                        </button>
                      ) : <span />}
                      <Btn variant="primary" onClick={saveRemoteConfig} disabled={savingRemote}>
                        {savingRemote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save
                      </Btn>
                    </div>
                  </Section>

                  <Section title="Password Protection" icon={Shield}>
                    <p className="text-sm text-muted-foreground mb-4">
                      When enabled, external visitors must enter this password. Local connections (Electron window, same-machine browser) bypass the gate automatically.
                    </p>
                    {remoteConfig?.hasPassword ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                          <span className="text-green-400 font-medium">Password is set</span>
                        </div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block">Change Password</label>
                        <div className="space-y-2">
                          <div className="relative">
                            <input type={showPassword ? "text" : "password"} placeholder="New password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)}
                              className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                            <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <input type={showPassword ? "text" : "password"} placeholder="Confirm password" value={confirmPasswordInput} onChange={e => setConfirmPasswordInput(e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                          <div className="flex gap-2 justify-end">
                            <Btn variant="danger" size="xs" onClick={clearRemotePassword}><X className="w-3 h-3" /> Remove Password</Btn>
                            <Btn variant="primary" onClick={saveRemotePassword} disabled={settingPassword || !passwordInput}>
                              {settingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />} Change
                            </Btn>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm">
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span className="text-amber-400">No password — set one if enabling remote access</span>
                        </div>
                        <div className="space-y-2">
                          <div className="relative">
                            <input type={showPassword ? "text" : "password"} placeholder="Set a password…" value={passwordInput} onChange={e => setPasswordInput(e.target.value)}
                              className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                            <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <input type={showPassword ? "text" : "password"} placeholder="Confirm password" value={confirmPasswordInput} onChange={e => setConfirmPasswordInput(e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                          <div className="flex justify-end">
                            <Btn variant="primary" onClick={saveRemotePassword} disabled={settingPassword || !passwordInput}>
                              {settingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />} Set Password
                            </Btn>
                          </div>
                        </div>
                      </div>
                    )}
                  </Section>

                  <Section title="Server URL" icon={Smartphone}>
                    <p className="text-sm text-muted-foreground mb-3">
                      When you open the BuildVerse Android app for the first time, enter the URL below to connect it to this machine.
                    </p>
                    <div className="space-y-2">
                      {lanUrl && (
                        <div className="p-3 rounded-xl bg-secondary border border-border">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">LAN (same Wi-Fi)</p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 text-sm font-mono break-all">{lanUrl}</code>
                            <Btn size="xs" onClick={() => { navigator.clipboard.writeText(lanUrl!); toast({ title: "Copied" }); }}>
                              <Copy className="w-3 h-3" /> Copy
                            </Btn>
                          </div>
                        </div>
                      )}
                      {externalUrl && (
                        <div className="p-3 rounded-xl bg-secondary border border-border">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">External (anywhere)</p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 text-sm font-mono break-all">{externalUrl}</code>
                            <Btn size="xs" onClick={() => { navigator.clipboard.writeText(externalUrl!); toast({ title: "Copied" }); }}>
                              <Copy className="w-3 h-3" /> Copy
                            </Btn>
                          </div>
                        </div>
                      )}
                      {!lanUrl && !externalUrl && (
                        <div className="p-3 rounded-xl bg-secondary/60 border border-border/60 font-mono text-sm text-muted-foreground">
                          {`http://YOUR_IP:${remotePort || 3456}`}
                        </div>
                      )}
                      {!remoteEnabled && (
                        <p className="text-xs text-amber-400 flex items-center gap-1.5 pt-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          Enable Remote Access above so your phone can reach this machine.
                        </p>
                      )}
                    </div>
                  </Section>

                  <Section title="Self-host with Docker" icon={Database}>
                    <p className="text-sm text-muted-foreground mb-4">
                      Run BuildVerse as a headless server on any machine — a home server, NAS, or VPS. Your phone connects to it just like the desktop app.
                    </p>
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-secondary/60 border border-border text-xs font-mono space-y-1 text-muted-foreground overflow-x-auto">
                        <p className="text-foreground font-semibold text-xs mb-2 font-sans not-italic">docker-compose.yml</p>
                        <p>services:</p>
                        <p>&nbsp;&nbsp;buildverse:</p>
                        <p>&nbsp;&nbsp;&nbsp;&nbsp;image: ghcr.io/anthonykphoto/buildverse:latest</p>
                        <p>&nbsp;&nbsp;&nbsp;&nbsp;ports:</p>
                        <p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- &quot;3456:3000&quot;</p>
                        <p>&nbsp;&nbsp;&nbsp;&nbsp;volumes:</p>
                        <p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- buildverse-data:/data</p>
                        <p>&nbsp;&nbsp;&nbsp;&nbsp;restart: unless-stopped</p>
                        <p>volumes:</p>
                        <p>&nbsp;&nbsp;buildverse-data:</p>
                      </div>
                      <div className="p-3 rounded-xl bg-secondary/60 border border-border text-xs space-y-1.5 text-muted-foreground">
                        <p>1. Copy the compose file above to your server.</p>
                        <p>2. Run <code className="bg-secondary px-1 rounded">docker compose up -d</code></p>
                        <p>3. Open the Android app → enter <code className="bg-secondary px-1 rounded">http://YOUR_SERVER_IP:3456</code></p>
                        <p>4. Data is stored in the <code className="bg-secondary px-1 rounded">buildverse-data</code> Docker volume.</p>
                      </div>
                    </div>
                  </Section>
                </>
              )}
            </>
          )}

          {/* ══════════════════════ MOBILE SYNC ═════════════════════════ */}
          {section === "sync" && (() => {
            const METHODS: { id: SyncMethod; label: string; desc: string }[] = [
              { id:"gdrive", label:"Google Drive",      desc:"Sign in with Google to sync all your data automatically. Works across desktop, Android, and any browser." },
              { id:"server", label:"BuildVerse Server", desc:"Phone pulls directly from your PC via LAN or remote access URL. No third-party cloud needed." },
              { id:"webdav", label:"WebDAV",            desc:"Nextcloud, OneDrive, Synology NAS, or any WebDAV-compatible service. Each user provides their own credentials." },
            ];
            const syncColor = { info:"text-muted-foreground", success:"text-green-400", error:"text-red-400" } as const;
            return (
              <>
                <Section title="Mobile Sync" icon={Cloud}>
                  <p className="text-sm text-muted-foreground mb-4">
                    Choose how your phone syncs BuildVerse data. Each user configures their own provider — nothing is shared.
                  </p>

                  {/* Method selector */}
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Sync Method</p>
                  <div className="space-y-2 mb-5">
                    {METHODS.map(m => (
                      <label key={m.id}
                        onClick={() => setSyncMethod(m.id)}
                        className={cn(
                          "flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors",
                          syncMethod === m.id ? "border-theme bg-theme/5" : "border-border bg-secondary/40 hover:border-border/80"
                        )}
                      >
                        <div className={cn(
                          "w-4.5 h-4.5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center",
                          syncMethod === m.id ? "border-theme bg-theme" : "border-border/80"
                        )}>
                          {syncMethod === m.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{m.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                  {/* Config fields */}
                  {syncMethod === "server" && (
                    <div className="space-y-3 mb-5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">How it works</p>
                      <div className="p-3 rounded-xl bg-secondary/60 border border-border text-sm space-y-1.5 text-muted-foreground">
                        <p>1. Enable Remote Access in Settings → Remote Access.</p>
                        <p>2. Open the Android app → Sync → enter your server URL.</p>
                        <p>3. Tap <strong className="text-foreground">Pull</strong> on the phone to download your garage.</p>
                        <p>4. When offline, changes queue locally. Tap <strong className="text-foreground">Push</strong> to sync back.</p>
                      </div>
                      {lanUrl && (
                        <div className="p-3 rounded-xl bg-secondary border border-border">
                          <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-widest">Your server URL (LAN)</p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 text-sm font-mono break-all">{lanUrl}</code>
                            <Btn size="xs" onClick={() => { navigator.clipboard.writeText(lanUrl!); toast({ title: "Copied" }); }}>
                              <Copy className="w-3 h-3" /> Copy
                            </Btn>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {syncMethod === "gdrive" && (
                    <div className="space-y-3 mb-5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Google Account</p>
                      {gdriveEmail ? (
                        <div className="p-3.5 rounded-xl border border-green-500/30 bg-green-500/5 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-green-400">Connected</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{gdriveEmail}</p>
                            {gdriveLastSync && <p className="text-xs text-muted-foreground mt-0.5">Last sync: {new Date(gdriveLastSync).toLocaleString()}</p>}
                          </div>
                          <Btn size="xs" variant="outline" onClick={handleGdriveDisconnect}>Disconnect</Btn>
                        </div>
                      ) : gdriveWaiting ? (
                        <div className="p-3.5 rounded-xl border border-theme/30 bg-theme/5 flex items-center gap-3">
                          <Loader2 className="w-4 h-4 animate-spin text-theme shrink-0" />
                          <div>
                            <p className="text-sm font-medium">Waiting for Google sign-in…</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Complete sign-in in your browser, then return here.</p>
                          </div>
                          <Btn size="xs" variant="outline" onClick={() => setGdriveWaiting(false)}>Cancel</Btn>
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-xl border border-border bg-secondary/40">
                          <p className="text-sm text-muted-foreground mb-3">Connect your Google account to enable sync. Your data is stored in a private app folder in your Drive — not visible to other apps.</p>
                          <button
                            onClick={handleGdriveConnect}
                            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white text-gray-700 text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
                          >
                            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                            Sign in with Google
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {syncMethod === "webdav" && (
                    <div className="space-y-3 mb-5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">WebDAV Config</p>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">WebDAV URL</label>
                        <input type="url" value={webdavUrl} onChange={e => { setWebdavUrl(e.target.value); localStorage.setItem("bv_sync_webdav_url", e.target.value); }}
                          placeholder="https://nextcloud.example.com/remote.php/dav/files/user/"
                          className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">Username</label>
                          <input type="text" value={webdavUsername} onChange={e => { setWebdavUsername(e.target.value); localStorage.setItem("bv_sync_webdav_username", e.target.value); }}
                            autoComplete="off"
                            className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">Password</label>
                          <div className="relative">
                            <input type={showWebdavPass ? "text" : "password"} value={webdavPassword} onChange={e => { setWebdavPassword(e.target.value); localStorage.setItem("bv_sync_webdav_password", e.target.value); }}
                              autoComplete="off"
                              className="w-full px-3 py-2 pr-9 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                            <button type="button" onClick={() => setShowWebdavPass(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" tabIndex={-1}>
                              {showWebdavPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">Enter the same credentials in the Android app → Sync → WebDAV.</p>
                    </div>
                  )}


                  {/* Status */}
                  {lastSyncedAt && (
                    <p className="text-xs text-muted-foreground mb-4">
                      Last sync: {new Date(lastSyncedAt).toLocaleString()}
                    </p>
                  )}

                  {syncMsg && (
                    <p className={cn("text-xs mb-4", syncColor[syncMsg.type])}>{syncMsg.text}</p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 flex-wrap">
                    {syncMethod === "gdrive" && gdriveEmail && (
                      <>
                        <Btn variant="primary" onClick={doSyncUpload} disabled={!!syncingDir}>
                          {syncingDir === "upload" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                          Back up to Drive
                        </Btn>
                        <Btn variant="outline" onClick={doSyncDownload} disabled={!!syncingDir}>
                          {syncingDir === "download" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                          Restore from Drive
                        </Btn>
                      </>
                    )}
                    {syncMethod === "gdrive" && !gdriveEmail && (
                      <p className="text-xs text-muted-foreground">Connect your Google account above to enable sync.</p>
                    )}
                    {syncMethod === "webdav" && (
                      <>
                        <Btn variant="primary" onClick={doSyncUpload} disabled={!!syncingDir}>
                          {syncingDir === "upload" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                          Push to WebDAV
                        </Btn>
                        <Btn variant="outline" onClick={doSyncDownload} disabled={!!syncingDir}>
                          {syncingDir === "download" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                          Pull changes from phone
                        </Btn>
                      </>
                    )}
                    {syncMethod === "server" && (
                      <p className="text-xs text-muted-foreground">Use the Android app to pull/push via your server URL above.</p>
                    )}
                  </div>
                </Section>

                <Section title="Setup Guide" icon={Smartphone}>
                  <p className="text-sm text-muted-foreground mb-3">
                    On your Android phone, open the BuildVerse app → tap the sync icon (↺) in the top-right → choose the same sync method above → tap <strong className="text-foreground">Pull</strong> to load your garage data for offline use.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    When you add notes or log service offline, they queue automatically. Tap <strong className="text-foreground">Push</strong> to send them back when you have a connection.
                  </p>
                </Section>
              </>
            );
          })()}

          {/* ════════════════════════ INTEGRATIONS ═══════════════════════ */}
          {section === "integrations" && (
            <>
              <Section title="Product Tracking" icon={ShoppingBag}>
                <Row label="Auto-track mod product links" desc="When you add or edit a mod with a product URL, automatically add it to Product Tracker." last>
                  <Toggle on={autoTrackProducts} onChange={v => { setAutoTrackProducts(v); localStorage.setItem("bv_autoTrackProducts", String(v)); }} />
                </Row>
              </Section>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 px-1">LubeLogger</p>
                <LubeLoggerSettings />
              </div>
            </>
          )}

          {/* ══════════════════════ DATA & BACKUP ════════════════════════ */}
          {section === "data" && (
            <>
              {stats && (
                <Section title="Database" icon={Database}>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Vehicles", value: stats.vehicleCount },
                      { label: "Modifications", value: stats.modCount },
                      { label: "Products", value: stats.productCount },
                    ].map(({ label, value }) => (
                      <div key={label} className="surface-inset p-4 text-center">
                        <p className="text-2xl font-bold">{value}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                  {appInfo && <p className="text-xs text-muted-foreground mt-3 font-mono opacity-60">{appInfo.dbPath}</p>}
                </Section>
              )}

              <Section title="Data Management" icon={HardDrive}>
                <Row label="Export Data" desc="Download all vehicles, mods & products as JSON">
                  <Btn onClick={handleExport}><Download className="w-3.5 h-3.5" /> Export JSON</Btn>
                </Row>
                <Row label="Import Data" desc="Restore from a BuildVerse JSON export file">
                  <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
                  <Btn onClick={() => importRef.current?.click()} disabled={importing}>
                    {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {importing ? "Importing…" : "Import JSON"}
                  </Btn>
                </Row>
                {isElectron && (
                  <>
                    <Row label="Export Transfer Pack" desc="Full ZIP archive — use to move BuildVerse to another computer">
                      <Btn onClick={handleExportZip} disabled={zipExporting}>
                        {zipExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                        {zipExporting ? "Exporting…" : "Export Pack"}
                      </Btn>
                    </Row>
                    <Row label="Import Transfer Pack" desc="Restore from a .zip transfer pack — replaces all data and restarts">
                      <Btn onClick={handleImportZip} disabled={zipImporting}>
                        {zipImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        {zipImporting ? "Importing…" : "Import Pack"}
                      </Btn>
                    </Row>
                  </>
                )}
                <Row label="Refresh Product Prices" desc="Re-scrape all tracked product URLs">
                  <Btn onClick={refreshAll}><RefreshCw className="w-3.5 h-3.5" /> Refresh All</Btn>
                </Row>
                <Row label="Remove Example Data" desc="Delete the Example S2000 sample vehicle. Your own vehicles are untouched.">
                  <Btn onClick={removeSampleData}><Trash2 className="w-3.5 h-3.5" /> Remove</Btn>
                </Row>
                <Row label="Wipe All Data" desc="Delete every vehicle, mod, maintenance log and product. Cannot be undone." last>
                  <Btn variant="danger" onClick={wipeAllData}><Trash2 className="w-3.5 h-3.5" /> Wipe Everything</Btn>
                </Row>
              </Section>

              {isElectron && (
                <Section title="Backups" icon={Archive}
                  action={
                    <Btn onClick={createBackup} disabled={loadingBkp}>
                      {loadingBkp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />} New Backup
                    </Btn>
                  }
                >
                  <p className="text-xs text-muted-foreground mb-3">
                    Auto-backup on startup · 10 most recent kept
                    {appInfo && <span className="font-mono ml-2 opacity-60">{appInfo.userDataPath}/backups</span>}
                  </p>
                  {loadingBkp ? (
                    <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
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
            </>
          )}

        </div>
      </div>
    </div>
  );
}
