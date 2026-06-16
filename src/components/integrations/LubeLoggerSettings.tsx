"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle2, AlertCircle, Loader2, ExternalLink, RefreshCw,
  Link2, Link2Off, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LL_RECORD_TYPES } from "@/lib/lubelogger";

// ─── Types ────────────────────────────────────────────────────────────────────
interface LLVehicle { id: number; year: string; make: string; model: string; licensePlate?: string; vin?: string; }
interface BVVehicle  { id: string; name?: string | null; year: number; make: string; model: string; }

interface Config {
  url: string; authType: "apikey" | "basic"; apiKey: string; password: string;
  username: string; vehicleMap: Record<string, string>; importTypes: string[];
  syncInterval: "off" | "hourly" | "daily" | "weekly"; lastSync: string | null;
  hasApiKey: boolean; hasPassword: boolean;
}

const INTERVALS: { value: Config["syncInterval"]; label: string }[] = [
  { value: "off",    label: "Manual only" },
  { value: "hourly", label: "Every hour" },
  { value: "daily",  label: "Every day" },
  { value: "weekly", label: "Every week" },
];

function vLabel(v: BVVehicle) { return v.name ? `${v.name} (${v.year} ${v.make} ${v.model})` : `${v.year} ${v.make} ${v.model}`; }
function llLabel(v: LLVehicle) { return `${v.year} ${v.make} ${v.model}${v.licensePlate ? ` · ${v.licensePlate}` : ""}`; }

// ─── Component ────────────────────────────────────────────────────────────────
export function LubeLoggerSettings() {
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState<Config | null>(null);

  // Form state (local draft)
  const [url, setUrl] = useState("");
  const [authType, setAuthType] = useState<"apikey" | "basic">("apikey");
  const [apiKey, setApiKey] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [importTypes, setImportTypes] = useState<string[]>(["servicerecords", "oilchanges", "repairs"]);
  const [syncInterval, setSyncInterval] = useState<Config["syncInterval"]>("off");

  // Connection state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Vehicle mapping state
  const [llVehicles, setLlVehicles] = useState<LLVehicle[]>([]);
  const [bvVehicles, setBvVehicles] = useState<BVVehicle[]>([]);
  const [vehicleMap, setVehicleMap] = useState<Record<string, string>>({});
  const [loadingVehicles, setLoadingVehicles] = useState(false);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{ imported: number; skipped: number; errors: number } | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Saving
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/lubelogger/config");
      if (res.ok) {
        const data: Config = await res.json();
        setCfg(data);
        setUrl(data.url);
        setAuthType(data.authType);
        setApiKey(data.hasApiKey ? "••••••••" : "");
        setUsername(data.username);
        setPassword(data.hasPassword ? "••••••••" : "");
        setImportTypes(data.importTypes);
        setSyncInterval(data.syncInterval);
        setVehicleMap(data.vehicleMap);
        setLastSync(data.lastSync);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (open) loadConfig();
  }, [open, loadConfig]);

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/integrations/lubelogger/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, authType, apiKey, username, password }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        // Save in background so subsequent syncs pick up the latest config
        handleSave(true);
        setTestResult({ ok: true, msg: `Connected — ${data.vehicleCount} vehicle${data.vehicleCount !== 1 ? "s" : ""} found` });
        await loadVehicles();
      } else {
        setTestResult({ ok: false, msg: data.error || "Connection failed" });
      }
    } catch (err) {
      setTestResult({ ok: false, msg: err instanceof Error ? err.message : "Network error" });
    } finally {
      setTesting(false);
    }
  };

  const loadVehicles = async () => {
    setLoadingVehicles(true);
    try {
      const res = await fetch("/api/integrations/lubelogger/vehicles");
      if (res.ok) {
        const data = await res.json();
        setLlVehicles(Array.isArray(data.lubelogger) ? data.lubelogger : []);
        setBvVehicles(Array.isArray(data.buildverse) ? data.buildverse : []);
        setVehicleMap(data.vehicleMap || {});
      }
    } catch {}
    finally { setLoadingVehicles(false); }
  };

  const handleSave = async (silent = false) => {
    setSaving(true);
    try {
      await fetch("/api/integrations/lubelogger/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url, authType,
          apiKey:   apiKey   !== "••••••••" ? apiKey   : "••••••••",
          username,
          password: password !== "••••••••" ? password : "••••••••",
          importTypes, syncInterval, vehicleMap,
        }),
      });
      if (!silent) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    await handleSave(true);
    setSyncing(true);
    setLastSyncResult(null);
    try {
      const res = await fetch("/api/integrations/lubelogger/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setLastSyncResult({ imported: data.imported, skipped: data.skipped, errors: data.errors });
        setLastSync(data.syncedAt);
      } else {
        setLastSyncResult({ imported: 0, skipped: 0, errors: 1 });
      }
    } catch {
      setLastSyncResult({ imported: 0, skipped: 0, errors: 1 });
    } finally {
      setSyncing(false);
    }
  };

  const toggleMap = (llId: number, bvId: string) => {
    setVehicleMap((prev) => {
      const key = String(llId);
      if (prev[key] === bvId) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: bvId };
    });
  };

  const toggleImportType = (key: string) => {
    setImportTypes((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const mappedCount = Object.keys(vehicleMap).length;
  const hasCredentials = (authType === "apikey" && (apiKey || cfg?.hasApiKey)) ||
                         (authType === "basic"  && (username && (password || cfg?.hasPassword)));

  return (
    <div className="border border-border rounded-2xl overflow-hidden">
      {/* Header — always visible */}
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/40 transition-colors text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            {/* LubeLogger oil-drop icon substitute */}
            <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.5 7 6 10.5 6 14a6 6 0 0012 0c0-3.5-2.5-7-6-12z"/>
            </svg>
          </div>
          <div>
            <p className="font-semibold text-sm">LubeLogger Integration</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {cfg?.url
                ? `${cfg.url} · ${Object.keys(cfg.vehicleMap).length} vehicle${Object.keys(cfg.vehicleMap).length !== 1 ? "s" : ""} linked`
                : "Not configured"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {cfg?.url && <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />}
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-5 py-5 space-y-6">

          {/* What is LubeLogger */}
          <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-3 flex items-start gap-2.5">
            <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.5 7 6 10.5 6 14a6 6 0 0012 0c0-3.5-2.5-7-6-12z"/>
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-blue-300">What is LubeLogger?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                LubeLogger is a free self-hosted vehicle maintenance tracker. Sync your service records,
                oil changes, and repairs directly into BuildVerse.
              </p>
              <a
                href="https://github.com/hargata/lubelog"
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-1"
              >
                <ExternalLink className="w-3 h-3" /> github.com/hargata/lubelog
              </a>
            </div>
          </div>

          {/* ── Connection ─────────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Connection</p>

            <div>
              <label className="text-xs font-medium block mb-1">LubeLogger URL</label>
              <input
                type="text"
                placeholder="https://lubelogger.yourserver.com  or  192.168.1.100:8080"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Any format works — local IP, domain name, with or without port, HTTP or HTTPS.
              </p>
            </div>

            {/* Auth type toggle */}
            <div>
              <label className="text-xs font-medium block mb-1">Authentication</label>
              <div className="flex rounded-lg overflow-hidden border border-input text-xs w-fit">
                <button
                  onClick={() => setAuthType("apikey")}
                  className={cn("px-3 py-1.5 font-medium transition-colors", authType === "apikey" ? "bg-theme text-white" : "hover:bg-secondary")}
                >
                  API Key / Token
                </button>
                <button
                  onClick={() => setAuthType("basic")}
                  className={cn("px-3 py-1.5 font-medium transition-colors", authType === "basic" ? "bg-theme text-white" : "hover:bg-secondary")}
                >
                  Username + Password
                </button>
              </div>
            </div>

            {authType === "apikey" ? (
              <div>
                <label className="text-xs font-medium block mb-1">API Key / Bearer Token</label>
                <input
                  type="password"
                  placeholder="Generate one in LubeLogger → Profile → API Token"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Recommended — works with Authelia, Traefik, Nginx Proxy Manager, and other reverse proxies.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1">Username</label>
                  <input
                    type="text"
                    placeholder="admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <p className="text-xs text-muted-foreground col-span-2">
                  If you use Authelia or similar SSO, use API Key instead — basic auth must be able to reach LubeLogger&apos;s <code className="text-xs bg-secondary px-1 rounded">/api/user/login</code> directly.
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={testConnection}
                disabled={testing || !url || !hasCredentials}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-theme text-white hover:brightness-110 disabled:opacity-50 transition-all font-medium"
              >
                {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                {testing ? "Testing…" : "Test Connection"}
              </button>
              {!url && <span className="text-xs text-muted-foreground">Enter URL first</span>}
              {testResult && (
                <div className={cn(
                  "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border",
                  testResult.ok
                    ? "bg-green-500/10 border-green-500/30 text-green-400"
                    : "bg-red-500/10 border-red-500/30 text-red-400"
                )}>
                  {testResult.ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  {testResult.msg}
                </div>
              )}
            </div>
          </div>

          {/* ── Vehicle Mapping ────────────────────────────────── */}
          {(llVehicles.length > 0 || loadingVehicles) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Vehicle Mapping</p>
                <button
                  onClick={loadVehicles}
                  disabled={loadingVehicles}
                  className="text-xs text-theme hover:underline flex items-center gap-1"
                >
                  <RefreshCw className={cn("w-3 h-3", loadingVehicles && "animate-spin")} />
                  Refresh
                </button>
              </div>

              {loadingVehicles ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading vehicles…
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr,auto,1fr] gap-2 text-xs font-medium text-muted-foreground pb-1">
                    <span>LubeLogger Vehicle</span>
                    <span />
                    <span>BuildVerse Vehicle</span>
                  </div>
                  {llVehicles.map((llv) => {
                    const linkedBvId = vehicleMap[String(llv.id)];
                    const linkedBv = bvVehicles.find((b) => b.id === linkedBvId);
                    return (
                      <div key={llv.id} className="grid grid-cols-[1fr,auto,1fr] gap-2 items-center">
                        <div className="px-3 py-2 rounded-lg bg-secondary/50 text-xs">
                          <p className="font-medium">{llLabel(llv)}</p>
                          {llv.vin && <p className="text-muted-foreground font-mono text-xs">{llv.vin}</p>}
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          {linkedBvId
                            ? <Link2 className="w-4 h-4 text-green-400" />
                            : <Link2Off className="w-4 h-4 text-muted-foreground/40" />
                          }
                        </div>
                        <select
                          value={linkedBvId || ""}
                          onChange={(e) => {
                            if (!e.target.value) {
                              setVehicleMap((prev) => {
                                const next = { ...prev };
                                delete next[String(llv.id)];
                                return next;
                              });
                            } else {
                              toggleMap(llv.id, e.target.value);
                            }
                          }}
                          className="w-full px-2 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="">— Not linked —</option>
                          {bvVehicles.map((bv) => (
                            <option key={bv.id} value={bv.id}>{vLabel(bv)}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                  {mappedCount > 0 && (
                    <p className="text-xs text-green-400">{mappedCount} vehicle{mappedCount !== 1 ? "s" : ""} linked</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Import Types ───────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">What to Import</p>
            <div className="grid grid-cols-2 gap-2">
              {LL_RECORD_TYPES.map((t) => (
                <label key={t.key} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={importTypes.includes(t.key)}
                    onChange={() => toggleImportType(t.key)}
                    className="accent-[hsl(var(--theme))]"
                  />
                  <span className="text-sm group-hover:text-foreground transition-colors">{t.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* ── Auto-Sync Interval ─────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Auto-Sync</p>
            <div className="flex flex-wrap gap-2">
              {INTERVALS.map((iv) => (
                <button
                  key={iv.value}
                  onClick={() => setSyncInterval(iv.value)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors",
                    syncInterval === iv.value
                      ? "bg-theme/15 border-theme/40 text-theme"
                      : "border-border hover:bg-secondary"
                  )}
                >
                  {iv.label}
                </button>
              ))}
            </div>
            {syncInterval !== "off" && (
              <p className="text-xs text-muted-foreground">
                BuildVerse will automatically import new records in the background at the selected interval.
              </p>
            )}
          </div>

          {/* ── Sync Now + Status ──────────────────────────────── */}
          <div className="pt-2 border-t border-border space-y-3">
            {lastSync && (
              <p className="text-xs text-muted-foreground">
                Last synced: {new Date(lastSync).toLocaleString()}
              </p>
            )}
            {lastSyncResult && (
              <div className={cn(
                "text-xs px-3 py-2 rounded-lg border",
                lastSyncResult.errors > 0
                  ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                  : "bg-green-500/10 border-green-500/30 text-green-400"
              )}>
                Imported {lastSyncResult.imported} record{lastSyncResult.imported !== 1 ? "s" : ""},
                {" "}{lastSyncResult.skipped} already up to date
                {lastSyncResult.errors > 0 && `, ${lastSyncResult.errors} error${lastSyncResult.errors !== 1 ? "s" : ""}`}
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => handleSave()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-secondary disabled:opacity-50 transition-all font-medium"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                {saved ? "Saved!" : saving ? "Saving…" : "Save Settings"}
              </button>
              <button
                onClick={handleSync}
                disabled={syncing || mappedCount === 0 || !url}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400 hover:bg-blue-500/25 disabled:opacity-50 transition-all font-medium"
                title={mappedCount === 0 ? "Link at least one vehicle first" : "Import new records now"}
              >
                {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                {syncing ? "Syncing…" : "Sync Now"}
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
