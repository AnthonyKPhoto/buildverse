"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Database, HardDrive, RefreshCw, Download, Upload,
  Zap, Monitor, Palette, Moon, Sun,
  Archive, RotateCcw, Trash2, ArrowUpCircle,
  CheckCircle2, AlertCircle, Loader2, X, Save, ShoppingBag,
  Tag, Plus, GripVertical,
  Shield, Plug, Key, Cloud, Mail, Send, Copy,
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
interface HealthInfo { status: string; version: string; mode: "local" | "server"; }
interface CurrentUser { id: string; username: string; role: "admin" | "member"; }
interface ManagedUser { id: string; username: string; email: string | null; role: "admin" | "member"; mustChangePassword: boolean; createdAt: string; }
interface SmtpConfigForm { host: string; port: number; secure: boolean; username: string; from: string; hasPassword: boolean; }
interface AccessVehicle { id: string; name: string | null; year: number; make: string; model: string; createdByUserId: string | null; }
interface VehicleAccessData { vehicles: AccessVehicle[]; users: ManagedUser[]; grants: { vehicleId: string; userId: string }[]; }
type Section = "general" | "access" | "integrations" | "data";
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
      transfer?: {
        exportZip: () => Promise<{ canceled?: boolean; success?: boolean; filePath?: string; error?: string }>;
        importZip: () => Promise<{ canceled?: boolean; success?: boolean; error?: string }>;
      };
      server?: {
        testConnection: (url: string) => Promise<{ ok: true; data: HealthInfo } | { ok: false; error: string }>;
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

  const [restartNeeded, setRestartNeeded] = useState(false);

  // Server connection (Electron "connect to a self-hosted server" mode)
  const [serverMode, setServerMode] = useState<"local" | "remote">("local");
  const [serverUrl, setServerUrl] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [testError, setTestError] = useState<string | null>(null);

  // Account / multi-user (server mode only)
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "member">("member");
  const [addingUser, setAddingUser] = useState(false);
  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [revealedPassword, setRevealedPassword] = useState<{ username: string; password: string; emailError?: string } | null>(null);

  // SMTP (server mode, admin-only) — used to email temp passwords for
  // admin-created accounts.
  const [smtpConfig, setSmtpConfig] = useState<SmtpConfigForm | null>(null);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState("");
  const [testingSmtp, setTestingSmtp] = useState(false);

  // Per-vehicle edit access (server mode, admin-only)
  const [vehicleAccess, setVehicleAccess] = useState<VehicleAccessData | null>(null);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [togglingCell, setTogglingCell] = useState<string | null>(null);

  // Server Data (admin-only DB restore, server mode only)
  const [restorePassword, setRestorePassword] = useState("");
  const [restoring, setRestoring] = useState(false);
  const restoreDbRef = useRef<HTMLInputElement>(null);

  // Data & Backup state
  const [stats, setStats] = useState<Stats | null>(null);
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loadingBkp, setLoadingBkp] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [zipExporting, setZipExporting] = useState(false);
  const [zipImporting, setZipImporting] = useState(false);
  const [mergeZipImporting, setMergeZipImporting] = useState(false);
  const importRef      = useRef<HTMLInputElement>(null);
  const mergeZipRef    = useRef<HTMLInputElement>(null);

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

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) setUsers(await res.json());
    } catch {}
    finally { setLoadingUsers(false); }
  }, []);

  const loadVehicleAccess = useCallback(async () => {
    setLoadingAccess(true);
    try {
      const res = await fetch("/api/admin/vehicle-access");
      if (res.ok) setVehicleAccess(await res.json());
    } catch {}
    finally { setLoadingAccess(false); }
  }, []);

  const loadSmtpConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings/smtp");
      if (!res.ok) return;
      const data = await res.json();
      if (!data) return;
      setSmtpConfig(data);
      setSmtpHost(data.host);
      setSmtpPort(data.port);
      setSmtpSecure(data.secure);
      setSmtpUsername(data.username);
      setSmtpFrom(data.from);
    } catch {}
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("bv_autoTrackProducts");
    setAutoTrackProducts(stored === null ? true : stored === "true");
    loadStats();
    fetch("/api/health").then(r => r.json()).then(setHealth).catch(() => {});
    fetch("/api/auth/me").then(r => r.json()).then(({ user }) => {
      setCurrentUser(user);
      if (user?.role === "admin") { loadUsers(); loadSmtpConfig(); loadVehicleAccess(); }
    }).catch(() => {});
    if (isElectron) {
      window.electronAPI!.getAppInfo().then(setAppInfo).catch(() => {});
      loadBackups();
      window.electronAPI!.prefs.get().then(p => {
        setCloseModeState((p.closeMode as "background" | "quit") ?? "quit");
        setServerMode((p.serverMode as "local" | "remote") ?? "local");
        setServerUrl((p.serverUrl as string) ?? "");
      }).catch(() => {});
      const unsub = window.electronAPI!.update.onStatus(setUpdateStatus);
      return unsub;
    }
  }, [isElectron, loadBackups, loadStats, loadUsers, loadSmtpConfig, loadVehicleAccess]);

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

  const testServerConnection = async () => {
    if (!serverUrl) return;
    setTestStatus("testing");
    setTestError(null);
    const result = await window.electronAPI!.server!.testConnection(serverUrl);
    if (result.ok) {
      setTestStatus("ok");
    } else {
      setTestStatus("error");
      setTestError(result.error);
    }
  };

  const applyServerConnection = async (mode: "local" | "remote") => {
    if (mode === "remote" && !serverUrl) {
      toast({ title: "Enter a server URL first", variant: "destructive" });
      return;
    }
    await window.electronAPI!.prefs.set({ serverMode: mode, serverUrl });
    setServerMode(mode);
    setRestartNeeded(true);
    toast({ title: mode === "remote" ? "Server connection saved" : "Switched to local mode", description: "Restart BuildVerse to apply." });
  };

  const signOut = async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); }
    finally { window.location.href = "/login"; }
  };

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingUser(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername,
          role: newRole,
          ...(newPassword ? { password: newPassword } : {}),
          ...(newEmail ? { email: newEmail } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(Array.isArray(data.error) ? data.error[0]?.message : data.error);
      if (data.tempPassword) {
        // Email sending failed — surface the auto-generated password so the
        // admin can hand it to the user directly instead of a dead end.
        setRevealedPassword({ username: data.username, password: data.tempPassword, emailError: data.emailError });
        toast({ title: `User "${newUsername}" created`, description: "Couldn't email the temp password — copy it from the dialog.", variant: "destructive" });
      } else if (!newPassword) {
        toast({ title: `User "${newUsername}" created`, description: `Temp password emailed to ${newEmail}` });
      } else {
        toast({ title: `User "${newUsername}" created` });
      }
      setNewUsername(""); setNewPassword(""); setNewEmail(""); setNewRole("member");
      await loadUsers();
    } catch (err) {
      toast({ title: "Couldn't add user", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setAddingUser(false);
    }
  };

  const toggleVehicleAccess = async (vehicleId: string, userId: string, grant: boolean) => {
    const cellKey = `${vehicleId}:${userId}`;
    setTogglingCell(cellKey);
    try {
      const res = await fetch("/api/admin/vehicle-access", {
        method: grant ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId, userId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setVehicleAccess(prev => {
        if (!prev) return prev;
        const grants = grant
          ? [...prev.grants, { vehicleId, userId }]
          : prev.grants.filter(g => !(g.vehicleId === vehicleId && g.userId === userId));
        return { ...prev, grants };
      });
    } catch (err) {
      toast({ title: "Couldn't update access", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setTogglingCell(null);
    }
  };

  const saveSmtpConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSmtp(true);
    try {
      const res = await fetch("/api/admin/settings/smtp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: smtpHost, port: smtpPort, secure: smtpSecure, username: smtpUsername, from: smtpFrom,
          ...(smtpPassword ? { password: smtpPassword } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSmtpConfig(data);
      setSmtpPassword("");
      toast({ title: "SMTP settings saved" });
    } catch (err) {
      toast({ title: "Couldn't save SMTP settings", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setSavingSmtp(false);
    }
  };

  const sendTestEmail = async () => {
    if (!testEmailTo) return;
    setTestingSmtp(true);
    try {
      const res = await fetch("/api/admin/settings/smtp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmailTo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: `Test email sent to ${testEmailTo}` });
    } catch (err) {
      toast({ title: "Test email failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setTestingSmtp(false);
    }
  };

  const deleteUser = async (user: ManagedUser) => {
    if (!confirm(`Remove "${user.username}"? They'll be signed out and won't be able to log back in.`)) return;
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: `"${user.username}" removed` });
      setUsers(prev => prev.filter(u => u.id !== user.id));
    } catch (err) {
      toast({ title: "Couldn't remove user", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    }
  };

  const toggleUserRole = async (user: ManagedUser) => {
    const role = user.role === "admin" ? "member" : "admin";
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers(prev => prev.map(u => (u.id === user.id ? { ...u, role } : u)));
    } catch (err) {
      toast({ title: "Couldn't change role", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    }
  };

  const resetUserPassword = async (user: ManagedUser) => {
    if (resetPasswordValue.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPasswordValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: `Password reset for "${user.username}"` });
      setResetTarget(null);
      setResetPasswordValue("");
    } catch (err) {
      toast({ title: "Couldn't reset password", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    }
  };

  const handleRestoreDb = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!restorePassword) {
      toast({ title: "Enter the server password first", variant: "destructive" });
      if (restoreDbRef.current) restoreDbRef.current.value = "";
      return;
    }
    if (!confirm(`Replace the server's entire database with "${file.name}"? This cannot be undone.`)) {
      if (restoreDbRef.current) restoreDbRef.current.value = "";
      return;
    }
    setRestoring(true);
    try {
      const formData = new FormData();
      formData.append("password", restorePassword);
      formData.append("file", file);
      const res = await fetch("/api/admin/restore-db", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Restore failed");
      toast({ title: data.message || "Database restored", description: "The server is restarting — reload in a few seconds." });
      setRestorePassword("");
    } catch (err) {
      toast({ title: "Restore failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setRestoring(false);
      if (restoreDbRef.current) restoreDbRef.current.value = "";
    }
  };

  const handleExport = async () => {
    try {
      const [vehicleList, products] = await Promise.all([fetch("/api/vehicles").then(r => r.json()), fetch("/api/products").then(r => r.json())]);
      // The list endpoint is deliberately slim (partial mods, no maintenanceLogs
      // — it's used by the dashboard/garage grid) so fetch each vehicle's full
      // detail for export, otherwise maintenance history and full mod/budget
      // data silently get dropped on import.
      const vehicles = Array.isArray(vehicleList)
        ? await Promise.all(
            vehicleList.map((v: { id: string }) => fetch(`/api/vehicles/${v.id}`).then(r => r.json()))
          )
        : [];
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

  // Exported records have `null` for unset optional fields (that's what Prisma
  // returns); the create-endpoint schemas now accept that too, but stripping
  // here as well means a future new field can't silently reintroduce the gap.
  const stripNulls = <T extends Record<string, unknown>>(obj: T): Partial<T> => {
    const out: Partial<T> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== null) out[k as keyof T] = v as T[keyof T];
    }
    return out;
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
        const res = await fetch("/api/vehicles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(stripNulls({ name: vehicleData.name, year: vehicleData.year, make: vehicleData.make, model: vehicleData.model, trim: vehicleData.trim, engine: vehicleData.engine, transmission: vehicleData.transmission, drivetrain: vehicleData.drivetrain, vin: vehicleData.vin, mileage: vehicleData.mileage, platform: vehicleData.platform, color: vehicleData.color, photoUrl: vehicleData.photoUrl, notes: vehicleData.notes })) });
        if (!res.ok) continue;
        const newVehicle = await res.json();
        vehiclesImported++;
        for (const m of (modifications ?? [])) {
          const mr = await fetch(`/api/vehicles/${newVehicle.id}/modifications`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(stripNulls({ name: m.name, category: m.category, brand: m.brand, vendor: m.vendor, price: m.price, actualPrice: m.actualPrice, status: m.status, priority: m.priority, difficulty: m.difficulty, link: m.link, imageUrl: m.imageUrl, notes: m.notes, partNumber: m.partNumber, orderNumber: m.orderNumber, installDate: m.installDate, installMileage: m.installMileage, laborCost: m.laborCost, diyInstall: m.diyInstall })) });
          if (mr.ok) modsImported++;
        }
        for (const log of (maintenanceLogs ?? [])) {
          const lr = await fetch(`/api/vehicles/${newVehicle.id}/maintenance`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(stripNulls({ service: log.service, mileage: log.mileage, date: log.date, cost: log.cost, notes: log.notes, shop: log.shop, diy: log.diy, nextDue: log.nextDue, nextMiles: log.nextMiles })) });
          if (lr.ok) logsImported++;
        }
        for (const b of (budgets ?? [])) {
          await fetch(`/api/vehicles/${newVehicle.id}/budget`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(stripNulls({ category: b.category, planned: b.planned, actual: b.actual })) });
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

  // Additive zip import (server mode) — adds a second person's vehicles
  // without touching anyone else's, unlike the admin-only destructive
  // restore under Access & Sync → Server Data. See /api/import-zip.
  const handleMergeZipImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMergeZipImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import-zip", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      toast({
        title: `Imported ${data.vehiclesImported} vehicle${data.vehiclesImported === 1 ? "" : "s"}`,
        description: `${data.modsImported} mods, ${data.filesImported} files, ${data.tuneLogsImported} tune logs`,
      });
      loadStats();
    } catch (err) {
      toast({ title: "Import failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setMergeZipImporting(false);
      if (mergeZipRef.current) mergeZipRef.current.value = "";
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

  const NAV_ITEMS: { id: Section; label: string; icon: React.ElementType }[] = [
    { id: "general",      label: "General",       icon: Palette   },
    { id: "access",       label: "Access & Sync", icon: Cloud     },
    { id: "integrations", label: "Integrations",  icon: Plug      },
    { id: "data",         label: "Data & Backup", icon: HardDrive },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in">
      {/* Temp password reveal — shown when email delivery failed so the
          admin can still hand the account over manually. */}
      {revealedPassword && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-card p-5 space-y-3">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p className="text-sm font-semibold">Couldn't email the temp password</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {revealedPassword.emailError || "Delivery failed."} Share this password with{" "}
              <span className="font-medium text-foreground">{revealedPassword.username}</span> directly — they'll be asked to set their own on first sign-in.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 text-sm rounded-lg border border-input bg-secondary/40 select-all">{revealedPassword.password}</code>
              <Btn onClick={() => navigator.clipboard.writeText(revealedPassword.password)}>
                <Copy className="w-3.5 h-3.5" />
              </Btn>
            </div>
            <Btn variant="primary" className="w-full justify-center" onClick={() => setRevealedPassword(null)}>Done</Btn>
          </div>
        </div>
      )}

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

      {/* Two-column layout on desktop; stacked with a horizontal-scroll tab
          bar on mobile — this nav used to be a fixed w-52 sidebar with no
          breakpoint at all, which squeezed both columns into a narrow strip
          on phones. */}
      <div className="flex flex-col md:flex-row gap-6 items-start">

        {/* ── Sidebar ────────────────────────────────────────────────────── */}
        <nav className="w-full md:w-52 shrink-0 md:sticky md:top-0">
          <div className="flex md:block gap-1 md:space-y-0.5 overflow-x-auto md:overflow-visible pb-1 md:pb-0 -mx-1 px-1 md:mx-0 md:px-0">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={cn(
                  "shrink-0 md:w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left whitespace-nowrap",
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
                  <span className="text-xs font-mono bg-secondary border border-border px-2 py-1 rounded-md">
                    v{appInfo?.version ?? health?.version ?? "…"}
                  </span>
                </Row>
                <Row label="Stack"><span className="text-sm text-muted-foreground">Next.js 14 · Prisma · SQLite</span></Row>
                <Row label="Running in">
                  {isElectron
                    ? <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-theme/10 text-theme border border-theme/20 px-2 py-1 rounded-lg"><Monitor className="w-3 h-3" /> Electron</span>
                    : <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 rounded-lg">Browser</span>
                  }
                </Row>
                <Row label="Mode" last>
                  {health?.mode === "server" ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" /> Connected to Server
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-1 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Local / Offline
                    </span>
                  )}
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

          {/* ══════════════════════ ACCESS & SYNC ════════════════════════ */}

          {section === "access" && (
            <>
              {isElectron && (
                <Section title="Server Connection" icon={Cloud}>
                  <p className="text-xs text-muted-foreground mb-3">
                    Point BuildVerse at a self-hosted server so this PC and your phone share
                    the same live data. Leave disconnected to keep everything local to this PC.
                  </p>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={serverUrl}
                        onChange={e => { setServerUrl(e.target.value); setTestStatus("idle"); }}
                        placeholder="https://buildverse.yourdomain.com"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <Btn onClick={testServerConnection} disabled={!serverUrl || testStatus === "testing"}>
                        {testStatus === "testing" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Test"}
                      </Btn>
                    </div>

                    {testStatus === "ok" && (
                      <p className="text-xs text-green-400 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Reachable</p>
                    )}
                    {testStatus === "error" && (
                      <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> {testError || "Could not connect"}</p>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-muted-foreground">
                        Currently: <strong className="text-foreground">{serverMode === "remote" ? "Connected to server" : "Local"}</strong>
                      </span>
                      <div className="flex gap-2">
                        {serverMode === "remote" && (
                          <Btn onClick={() => applyServerConnection("local")}>Disconnect</Btn>
                        )}
                        <Btn variant="primary" onClick={() => applyServerConnection("remote")} disabled={!serverUrl}>
                          <Cloud className="w-3.5 h-3.5" /> Connect
                        </Btn>
                      </div>
                    </div>
                  </div>
                </Section>
              )}

              {health?.mode === "server" && currentUser && (
                <Section title="Account" icon={Shield}>
                  <Row label="Signed in as" last>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{currentUser.username}</span>
                      <span className={cn(
                        "text-2xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full",
                        currentUser.role === "admin" ? "bg-theme/15 text-theme" : "bg-secondary text-muted-foreground"
                      )}>
                        {currentUser.role}
                      </span>
                      <Btn variant="ghost" onClick={signOut}>Sign Out</Btn>
                    </div>
                  </Row>
                </Section>
              )}

              {health?.mode === "server" && currentUser?.role === "admin" && (
                <Section title="Users" icon={Shield}>
                  <p className="text-xs text-muted-foreground mb-3">
                    Everyone shares the same garage — accounts are just for individual sign-in.
                  </p>

                  {loadingUsers ? (
                    <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                    </div>
                  ) : (
                    <div className="space-y-1 mb-4">
                      {users.map(u => (
                        <div key={u.id} className="rounded-xl hover:bg-secondary transition-colors">
                          <div className="flex items-center justify-between px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium truncate">{u.username}</span>
                              <button
                                onClick={() => toggleUserRole(u)}
                                title="Click to toggle admin/member"
                                className={cn(
                                  "text-2xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full cursor-pointer",
                                  u.role === "admin" ? "bg-theme/15 text-theme" : "bg-secondary text-muted-foreground"
                                )}
                              >
                                {u.role}
                              </button>
                              {u.mustChangePassword && (
                                <span className="text-2xs text-muted-foreground shrink-0" title="Must set their own password on next sign-in">pending</span>
                              )}
                              {u.id === currentUser.id && <span className="text-2xs text-muted-foreground">(you)</span>}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Btn size="xs" onClick={() => { setResetTarget(u.id); setResetPasswordValue(""); }}>
                                <Key className="w-3 h-3" /> Reset Password
                              </Btn>
                              <Btn size="xs" variant="danger" onClick={() => deleteUser(u)} disabled={u.id === currentUser.id}>
                                <Trash2 className="w-3 h-3" />
                              </Btn>
                            </div>
                          </div>
                          {resetTarget === u.id && (
                            <div className="flex items-center gap-2 px-3 pb-3">
                              <input
                                type="password"
                                autoFocus
                                value={resetPasswordValue}
                                onChange={e => setResetPasswordValue(e.target.value)}
                                placeholder="New password (min 8 characters)"
                                className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                              />
                              <Btn size="xs" onClick={() => setResetTarget(null)}>Cancel</Btn>
                              <Btn size="xs" variant="primary" onClick={() => resetUserPassword(u)}>Save</Btn>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={addUser} className="pt-3 border-t border-border/60 space-y-2">
                    <div className="grid grid-cols-1 sm:flex sm:flex-wrap sm:items-center gap-2">
                      <input
                        type="text"
                        required
                        value={newUsername}
                        onChange={e => setNewUsername(e.target.value)}
                        placeholder="Username"
                        className="w-full sm:w-32 px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Password (optional)"
                        className="w-full sm:w-36 px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <input
                        type="email"
                        value={newEmail}
                        onChange={e => setNewEmail(e.target.value)}
                        placeholder="Email (for temp password)"
                        className="w-full sm:w-48 px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <select
                        value={newRole}
                        onChange={e => setNewRole(e.target.value as "admin" | "member")}
                        className="w-full sm:w-auto px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                      <Btn variant="primary" className="w-full sm:w-auto justify-center" disabled={addingUser || !newUsername || (!newPassword && !newEmail)}>
                        {addingUser ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        Add User
                      </Btn>
                    </div>
                    <p className="text-2xs text-muted-foreground">
                      Leave password blank and give an email to auto-generate one and email it — they'll set their own on first sign-in.
                    </p>
                  </form>
                </Section>
              )}

              {health?.mode === "server" && currentUser?.role === "admin" && (
                <Section title="Vehicle Access" icon={Key}>
                  <p className="text-xs text-muted-foreground mb-3">
                    Viewing the garage is always shared. Editing a vehicle is limited to admins, its creator (★), and anyone checked below.
                  </p>
                  {loadingAccess ? (
                    <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                    </div>
                  ) : !vehicleAccess || vehicleAccess.vehicles.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">No vehicles yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-border/60">
                            <th className="text-left font-medium text-muted-foreground py-2 pr-3 whitespace-nowrap">Vehicle</th>
                            {vehicleAccess.users.filter(u => u.role !== "admin").map(u => (
                              <th key={u.id} className="text-center font-medium text-muted-foreground py-2 px-2 whitespace-nowrap">{u.username}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {vehicleAccess.vehicles.map(v => (
                            <tr key={v.id} className="border-b border-border/40 last:border-0">
                              <td className="py-2 pr-3 whitespace-nowrap">{v.name || `${v.year} ${v.make} ${v.model}`}</td>
                              {vehicleAccess.users.filter(u => u.role !== "admin").map(u => {
                                const isCreator = v.createdByUserId === u.id;
                                const hasGrant = vehicleAccess.grants.some(g => g.vehicleId === v.id && g.userId === u.id);
                                const cellKey = `${v.id}:${u.id}`;
                                return (
                                  <td key={u.id} className="text-center py-2 px-2">
                                    {isCreator ? (
                                      <span title={`${u.username} created this vehicle — always has edit access`} className="text-theme">★</span>
                                    ) : (
                                      <input
                                        type="checkbox"
                                        checked={hasGrant}
                                        disabled={togglingCell === cellKey}
                                        onChange={e => toggleVehicleAccess(v.id, u.id, e.target.checked)}
                                        className="w-4 h-4 accent-theme cursor-pointer disabled:opacity-50"
                                      />
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Section>
              )}

              {health?.mode === "server" && currentUser?.role === "admin" && (
                <Section title="Email (SMTP)" icon={Mail}>
                  <p className="text-xs text-muted-foreground mb-3">
                    Used to email temporary passwords when you create an account by email instead of typing a password.
                  </p>
                  <form onSubmit={saveSmtpConfig} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">Host</label>
                        <input type="text" required value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.example.com"
                          className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">Port</label>
                        <input type="number" required value={smtpPort} onChange={e => setSmtpPort(Number(e.target.value))} placeholder="587"
                          className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">Username</label>
                        <input type="text" required value={smtpUsername} onChange={e => setSmtpUsername(e.target.value)} placeholder="you@example.com"
                          className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">Password</label>
                        <input type="password" value={smtpPassword} onChange={e => setSmtpPassword(e.target.value)}
                          placeholder={smtpConfig?.hasPassword ? "•••••••• (unchanged)" : "SMTP password"}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">From address</label>
                        <input type="text" required value={smtpFrom} onChange={e => setSmtpFrom(e.target.value)} placeholder="BuildVerse <noreply@example.com>"
                          className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                      </div>
                    </div>
                    <Row label="Use TLS (implicit)" desc="On for port 465, off for 587/25 (STARTTLS)" last>
                      <Toggle on={smtpSecure} onChange={setSmtpSecure} />
                    </Row>
                    <div className="flex items-center gap-2 pt-1">
                      <Btn variant="primary" disabled={savingSmtp}>
                        {savingSmtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save
                      </Btn>
                    </div>
                  </form>

                  {smtpConfig?.hasPassword && (
                    <div className="flex items-center gap-2 pt-3 mt-3 border-t border-border/60">
                      <input
                        type="email"
                        value={testEmailTo}
                        onChange={e => setTestEmailTo(e.target.value)}
                        placeholder="Send a test email to…"
                        className="flex-1 max-w-xs px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <Btn onClick={sendTestEmail} disabled={testingSmtp || !testEmailTo}>
                        {testingSmtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Send Test
                      </Btn>
                    </div>
                  )}
                </Section>
              )}

              {health?.mode === "server" && currentUser?.role === "admin" && (
                <Section title="Server Data" icon={HardDrive}>
                  <p className="text-xs text-muted-foreground mb-3">
                    One-time migration from the desktop app: <strong>Settings → Data &amp; Backup → New Backup</strong> gives
                    you a <code>.db</code> file (database only); <strong>Export Transfer Pack</strong> gives you a{" "}
                    <code>.zip</code> (database plus any uploaded vehicle files and tune logs — use this one if you have
                    those). Upload either here to seed this server — this replaces everything currently on the server.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">Server password (confirm)</label>
                      <input
                        type="password"
                        value={restorePassword}
                        onChange={e => setRestorePassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full max-w-xs px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <input ref={restoreDbRef} type="file" accept=".db,.zip" className="hidden" onChange={handleRestoreDb} />
                    <Btn variant="danger" onClick={() => restoreDbRef.current?.click()} disabled={restoring || !restorePassword}>
                      {restoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {restoring ? "Restoring…" : "Upload & Restore (.db or .zip)"}
                    </Btn>
                  </div>
                </Section>
              )}

              {!isElectron && !(health?.mode === "server" && currentUser) && (
                <Section title="Access & Sync" icon={Cloud}>
                  <p className="text-sm text-muted-foreground">
                    {health?.mode === "server"
                      ? "This connection isn't signed in as a specific user (e.g. a loopback/local request), so there's nothing personalized to show here. Sign in normally to see your account and, if you're an admin, user management."
                      : "This browser is talking to a local, single-machine instance of BuildVerse — there's nothing to configure here. Self-host BuildVerse with Docker to get a shared server that this page, the desktop app, and the Android app can all connect to (see the README)."}
                  </p>
                </Section>
              )}
            </>
          )}


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
                {health?.mode === "server" && currentUser && (
                  <Row label="Add Vehicles from Transfer Pack" desc="Bring in your own vehicles (and their files/tune logs) from a .zip — adds alongside what's already here, never touches anyone else's data">
                    <input ref={mergeZipRef} type="file" accept=".zip" className="hidden" onChange={handleMergeZipImport} />
                    <Btn onClick={() => mergeZipRef.current?.click()} disabled={mergeZipImporting}>
                      {mergeZipImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {mergeZipImporting ? "Importing…" : "Import Pack"}
                    </Btn>
                  </Row>
                )}
                {isElectron && serverMode === "local" && (
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
