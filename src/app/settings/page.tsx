"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Settings, Database, HardDrive, RefreshCw, Download,
  ExternalLink, Info, Zap, Monitor, Palette,
  Archive, RotateCcw, Trash2, ArrowUpCircle,
  CheckCircle2, AlertCircle, Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ACCENT_PRESETS, useCurrentAccent } from "@/components/ThemeProvider";

// ── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  vehicleCount: number;
  modCount: number;
  productCount: number;
  totalPlanned: number;
  totalInstalled: number;
  installedCount: number;
}

interface AppInfo {
  version: string;
  userDataPath: string;
  dbPath: string;
  isDev: boolean;
}

interface BackupEntry {
  name: string;
  filePath: string;
  size: number;
  createdAt: string;
}

type UpdateStatus =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "current" }
  | { status: "available"; version: string }
  | { status: "downloading"; percent: number }
  | { status: "downloaded"; version: string }
  | { status: "error" };

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      platform: string;
      getAppInfo: () => Promise<AppInfo>;
      backup: {
        create:  ()                       => Promise<{ success: boolean; filePath: string }>;
        list:    ()                       => Promise<BackupEntry[]>;
        restore: (filePath: string)       => Promise<{ success: boolean }>;
        delete:  (filePath: string)       => Promise<{ success: boolean }>;
      };
      update: {
        check:    ()                                    => Promise<void>;
        install:  ()                                    => Promise<void>;
        onStatus: (cb: (s: UpdateStatus) => void) => () => void;
      };
    };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatBackupDate(name: string) {
  const m = name.match(/buildverse-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/);
  if (!m) return name.replace(/\.db$/, "");
  return `${m[1]} at ${m[2]}:${m[3]}:${m[4]}`;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { toast } = useToast();
  const [stats, setStats]                 = useState<Stats | null>(null);
  const [appInfo, setAppInfo]             = useState<AppInfo | null>(null);
  const [backups, setBackups]             = useState<BackupEntry[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [updateStatus, setUpdateStatus]   = useState<UpdateStatus>({ status: "idle" });
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);

  const isElectron = typeof window !== "undefined" && !!window.electronAPI?.isElectron;
  const { accent, setAccent } = useCurrentAccent();

  const loadBackups = useCallback(async () => {
    if (!isElectron) return;
    setLoadingBackups(true);
    try {
      const list = await window.electronAPI!.backup.list();
      setBackups(list);
    } catch {
      /* silent */
    } finally {
      setLoadingBackups(false);
    }
  }, [isElectron]);

  useEffect(() => {
    fetch("/api/stats").then((r) => r.json()).then(setStats).catch(() => {});
    if (isElectron) {
      window.electronAPI!.getAppInfo().then(setAppInfo).catch(() => {});
      loadBackups();
      const unsub = window.electronAPI!.update.onStatus(setUpdateStatus);
      return unsub;
    }
  }, [isElectron, loadBackups]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleExport = async () => {
    try {
      const [vehicles, products] = await Promise.all([
        fetch("/api/vehicles").then((r) => r.json()),
        fetch("/api/products").then((r) => r.json()),
      ]);
      const data = { exportedAt: new Date().toISOString(), version: "1.0", vehicles, products };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url;
      a.download = `buildverse-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Data exported successfully!" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  const refreshAllProducts = async () => {
    try {
      const products = await fetch("/api/products").then((r) => r.json());
      if (!Array.isArray(products) || products.length === 0) {
        toast({ title: "No products to refresh" });
        return;
      }
      toast({ title: `Refreshing ${products.length} products…` });
      await Promise.all(products.map((p: { id: string }) =>
        fetch(`/api/products/${p.id}/refresh`, { method: "POST" })
      ));
      toast({ title: "All products refreshed!" });
    } catch {
      toast({ title: "Some products failed to refresh", variant: "destructive" });
    }
  };

  const handleCreateBackup = async () => {
    setLoadingBackups(true);
    try {
      await window.electronAPI!.backup.create();
      await loadBackups();
      toast({ title: "Backup created!" });
    } catch {
      toast({ title: "Failed to create backup", variant: "destructive" });
      setLoadingBackups(false);
    }
  };

  const handleRestoreBackup = async (filePath: string) => {
    setConfirmRestore(null);
    try {
      toast({ title: "Restoring backup — app will restart…" });
      await window.electronAPI!.backup.restore(filePath);
    } catch {
      toast({ title: "Restore failed — try closing the app first", variant: "destructive" });
    }
  };

  const handleDeleteBackup = async (filePath: string) => {
    try {
      await window.electronAPI!.backup.delete(filePath);
      setBackups((prev) => prev.filter((b) => b.filePath !== filePath));
      toast({ title: "Backup deleted" });
    } catch {
      toast({ title: "Failed to delete backup", variant: "destructive" });
    }
  };

  const handleCheckUpdate = () => {
    setUpdateStatus({ status: "checking" });
    window.electronAPI!.update.check();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const dbStoragePath = appInfo?.dbPath ?? "prisma/dev.db (project directory)";

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Appearance, updates, backups, and data management</p>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="w-4 h-4 text-theme" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide font-medium">Accent color</p>
          <div className="flex flex-wrap gap-2.5">
            {ACCENT_PRESETS.map((p) => (
              <button
                key={p.id}
                title={p.label}
                onClick={() => setAccent(p.id)}
                className={cn(
                  "w-7 h-7 rounded-full border-2 transition-all duration-150",
                  accent === p.id
                    ? "border-foreground scale-110 shadow-sm"
                    : "border-transparent hover:scale-110 opacity-60 hover:opacity-100"
                )}
                style={{ backgroundColor: `hsl(${p.value})` }}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3 capitalize">{accent} selected</p>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-theme" />
            About BuildVerse
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {[
            {
              label: "Version",
              value: <Badge variant="secondary">v{appInfo?.version ?? "1.0.0"}</Badge>,
            },
            {
              label: "Stack",
              value: <span className="text-sm">Next.js 14 · Prisma · SQLite</span>,
            },
            {
              label: "Running in",
              value: isElectron ? (
                <Badge className="bg-theme/20 text-theme border-theme/30 gap-1">
                  <Monitor className="w-3 h-3" />
                  Electron Desktop App
                </Badge>
              ) : (
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Browser</Badge>
              ),
            },
            {
              label: "Database",
              value: (
                <span className="text-xs font-mono text-muted-foreground truncate max-w-xs text-right">
                  {dbStoragePath}
                </span>
              ),
            },
            {
              label: "Mode",
              value: <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Local / Offline</Badge>,
            },
          ].map(({ label, value }, i, arr) => (
            <div
              key={label}
              className={cn(
                "flex items-center justify-between py-2.5",
                i < arr.length - 1 && "border-b border-border"
              )}
            >
              <span className="text-sm text-muted-foreground">{label}</span>
              {value}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Updates (Electron only) */}
      {isElectron && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpCircle className="w-4 h-4 text-theme" />
              Updates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {(updateStatus.status === "idle" || updateStatus.status === "current") && (
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                )}
                {(updateStatus.status === "checking" || updateStatus.status === "downloading") && (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
                )}
                {(updateStatus.status === "available" || updateStatus.status === "downloaded") && (
                  <ArrowUpCircle className="w-4 h-4 text-theme shrink-0" />
                )}
                {updateStatus.status === "error" && (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                )}
                <span className="text-sm">
                  {updateStatus.status === "idle"       && "—"}
                  {updateStatus.status === "checking"   && "Checking for updates…"}
                  {updateStatus.status === "current"    && "BuildVerse is up to date"}
                  {updateStatus.status === "available"  && `Version ${(updateStatus as { status: "available"; version: string }).version} available — downloading…`}
                  {updateStatus.status === "downloading" && `Downloading… ${(updateStatus as { status: "downloading"; percent: number }).percent}%`}
                  {updateStatus.status === "downloaded" && `Version ${(updateStatus as { status: "downloaded"; version: string }).version} ready to install`}
                  {updateStatus.status === "error"      && "Update check failed"}
                </span>
              </div>

              <div className="flex gap-2 shrink-0">
                {updateStatus.status !== "downloading" && updateStatus.status !== "downloaded" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updateStatus.status === "checking"}
                    onClick={handleCheckUpdate}
                    className="gap-1.5"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", updateStatus.status === "checking" && "animate-spin")} />
                    Check for Updates
                  </Button>
                )}
                {updateStatus.status === "downloaded" && (
                  <Button
                    size="sm"
                    onClick={() => window.electronAPI!.update.install()}
                    className="gap-1.5"
                  >
                    <ArrowUpCircle className="w-3.5 h-3.5" />
                    Restart & Install
                  </Button>
                )}
              </div>
            </div>

            {updateStatus.status === "downloading" && (
              <div className="h-1 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-theme rounded-full transition-all duration-300"
                  style={{ width: `${(updateStatus as { status: "downloading"; percent: number }).percent}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Database stats */}
      {stats && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-4 h-4 text-theme" />
              Database Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Vehicles",      value: stats.vehicleCount },
                { label: "Modifications", value: stats.modCount },
                { label: "Products",      value: stats.productCount },
              ].map(({ label, value }) => (
                <div key={label} className="text-center p-3 rounded-lg bg-secondary">
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Management */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-theme" />
            Data Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <div className="flex items-center justify-between py-2.5 border-b border-border">
            <div>
              <p className="text-sm font-medium">Export Data</p>
              <p className="text-xs text-muted-foreground">Download all data as a JSON file</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
              <Download className="w-3.5 h-3.5" />
              Export
            </Button>
          </div>

          <div className={cn(
            "flex items-center justify-between py-2.5",
            !isElectron && "border-b border-border"
          )}>
            <div>
              <p className="text-sm font-medium">Refresh All Product Prices</p>
              <p className="text-xs text-muted-foreground">Re-scrape all tracked product URLs</p>
            </div>
            <Button variant="outline" size="sm" onClick={refreshAllProducts} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh All
            </Button>
          </div>

          {!isElectron && (
            <div className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium">Prisma Studio</p>
                <p className="text-xs text-muted-foreground">Visual database browser</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono">npm run db:studio</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText("npm run db:studio");
                    toast({ title: "Copied to clipboard!" });
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backups (Electron only) */}
      {isElectron && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Archive className="w-4 h-4 text-theme" />
                Backups
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateBackup}
                disabled={loadingBackups}
                className="gap-1.5"
              >
                {loadingBackups ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                Create Backup
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground pb-3 border-b border-border">
              <span>Auto-backup on startup · Last 10 kept</span>
              <span className="font-mono truncate max-w-[220px]" title={`${appInfo?.userDataPath ?? ""}/backups`}>
                {appInfo?.userDataPath ?? "…"}/backups
              </span>
            </div>

            {loadingBackups ? (
              <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading…
              </div>
            ) : backups.length === 0 ? (
              <p className="text-sm text-muted-foreground py-1">
                No backups yet — one will be created automatically on next startup.
              </p>
            ) : (
              <div className="space-y-0.5">
                {backups.map((b) => (
                  <div
                    key={b.filePath}
                    className="flex items-center justify-between px-2 py-2 rounded-md hover:bg-secondary/50"
                  >
                    {confirmRestore === b.filePath ? (
                      <>
                        <span className="text-sm font-medium text-theme">
                          Restore this backup? The app will restart.
                        </span>
                        <div className="flex gap-2 shrink-0">
                          <Button variant="outline" size="sm" onClick={() => setConfirmRestore(null)}>
                            Cancel
                          </Button>
                          <Button size="sm" onClick={() => handleRestoreBackup(b.filePath)}>
                            Confirm
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{formatBackupDate(b.name)}</p>
                          <p className="text-xs text-muted-foreground">{formatBytes(b.size)}</p>
                        </div>
                        <div className="flex gap-1.5 shrink-0 ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmRestore(b.filePath)}
                            className="gap-1 h-7 px-2 text-xs"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Restore
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteBackup(b.filePath)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Developer Tools */}
      {!isElectron && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="w-4 h-4 text-theme" />
              Developer Tools
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <div className="flex items-start justify-between py-2.5 border-b border-border">
              <div>
                <p className="text-sm font-medium">Reset Database</p>
                <p className="text-xs text-muted-foreground">Wipe all data and reload demo vehicles (irreversible)</p>
              </div>
              <span className="text-xs text-muted-foreground font-mono self-center">npm run db:reset</span>
            </div>
            <div className="rounded-lg bg-secondary/50 p-3 mt-3">
              <p className="text-xs text-muted-foreground font-medium mb-2">Useful commands</p>
              <div className="space-y-1.5">
                {[
                  { cmd: "npm run dev",          desc: "Start dev server" },
                  { cmd: "npm run electron:dev", desc: "Open Electron window" },
                  { cmd: "npm run package:win",  desc: "Build Windows installer" },
                  { cmd: "npm run db:studio",    desc: "Open Prisma Studio" },
                  { cmd: "npm run db:reset",     desc: "Reset to demo data" },
                ].map(({ cmd, desc }) => (
                  <div key={cmd} className="flex items-center justify-between">
                    <code className="text-xs font-mono text-theme">{cmd}</code>
                    <span className="text-xs text-muted-foreground">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resources */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="w-4 h-4 text-theme" />
            Resources
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {[
            { label: "Next.js Documentation", url: "https://nextjs.org/docs" },
            { label: "Prisma ORM Docs",        url: "https://www.prisma.io/docs" },
            { label: "Tailwind CSS Docs",      url: "https://tailwindcss.com/docs" },
          ].map(({ label, url }, i, arr) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center justify-between py-2.5 px-2 -mx-2 rounded-md hover:bg-secondary transition-colors group",
                i < arr.length - 1 && "border-b border-border"
              )}
            >
              <span className="text-sm">{label}</span>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />
            </a>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center pb-2">
        All data stored locally — no cloud, no accounts required
      </p>
    </div>
  );
}
