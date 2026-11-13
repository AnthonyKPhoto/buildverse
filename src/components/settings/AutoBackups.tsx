"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, Download, Loader2, RotateCcw, Trash2, AlertTriangle } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Backup { name: string; size: number; createdAt: string }
interface Payload {
  settings: { enabled: boolean; intervalHours: number; keep: number };
  backups: Backup[]; dir: string; canRestore: boolean;
}

const INTERVALS = [
  { h: 6, label: "Every 6 hours" }, { h: 12, label: "Every 12 hours" }, { h: 24, label: "Daily" },
  { h: 72, label: "Every 3 days" }, { h: 168, label: "Weekly" },
];
const KEEPS = [3, 7, 14, 30];

const size = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const when = (iso: string) => `${formatDate(iso)} · ${new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={cn("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200", on ? "bg-theme" : "bg-secondary border border-border")}>
      <span className={cn("inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200", on ? "translate-x-4" : "translate-x-0.5")} />
    </button>
  );
}

/** Scheduled backups: settings, history, download / restore / delete. Renders nothing for non-admins. */
export function AutoBackups({ showList }: { showList: boolean }) {
  const { toast } = useToast();
  const [data, setData] = useState<Payload | null>(null);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [restoreBusy, setRestoreBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/backups");
      if (res.status === 401 || res.status === 403) { setHidden(true); return; }
      setData(await res.json());
    } catch { setHidden(true); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const saveSettings = async (patch: Partial<Payload["settings"]>) => {
    if (!data) return;
    setData({ ...data, settings: { ...data.settings, ...patch } });
    const res = await fetch("/api/admin/backups", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (!res.ok) toast({ title: "Couldn't save", variant: "destructive" });
    load();
  };

  const backUpNow = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/backups", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast({ title: "Backup created", description: `${d.backup.name} (${size(d.backup.size)})` });
      load();
    } catch (e) {
      toast({ title: "Backup failed", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const remove = async (name: string) => {
    if (!confirm("Delete this backup? This can't be undone.")) return;
    const res = await fetch(`/api/admin/backups/${encodeURIComponent(name)}`, { method: "DELETE" });
    if (res.ok) load(); else toast({ title: "Couldn't delete", variant: "destructive" });
  };

  const restore = async () => {
    if (!restoring) return;
    setRestoreBusy(true);
    try {
      const res = await fetch(`/api/admin/backups/${encodeURIComponent(restoring)}/restore`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast({ title: "Restored", description: "The server is restarting — reloading in a few seconds…" });
      setTimeout(() => window.location.reload(), 5000);
    } catch (e) {
      toast({ title: "Restore failed", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
      setRestoreBusy(false);
    }
  };

  if (hidden) return null;
  if (!data) return null;
  const s = data.settings;
  const newest = data.backups[0];

  return (
    <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-theme/10 flex items-center justify-center"><Archive className="w-3.5 h-3.5 text-theme" strokeWidth={2.2} /></div>
          <h3 className="font-semibold text-sm">Automatic backups</h3>
        </div>
        <button onClick={backUpNow} disabled={busy}
          className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-lg border border-border bg-secondary hover:bg-accent disabled:opacity-50">
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Archive className="w-3 h-3" />}Back up now
        </button>
      </div>

      <div className="px-5 py-1">
        <div className="flex items-center justify-between gap-4 py-3 border-b border-border/60">
          <div>
            <p className="text-sm font-medium">Back up automatically</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {newest ? `Last backup ${when(newest.createdAt)}` : "No backups yet"}
              {!s.enabled && " · automatic backups are off"}
            </p>
          </div>
          <Switch on={s.enabled} onChange={(v) => saveSettings({ enabled: v })} label="Automatic backups" />
        </div>
        <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-3 py-3", !s.enabled && "opacity-50")}>
          <label className="block"><span className="text-xs text-muted-foreground">How often</span>
            <select value={s.intervalHours} disabled={!s.enabled} onChange={(e) => saveSettings({ intervalHours: Number(e.target.value) })}
              className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring">
              {INTERVALS.map((i) => <option key={i.h} value={i.h}>{i.label}</option>)}
              {!INTERVALS.some((i) => i.h === s.intervalHours) && <option value={s.intervalHours}>Every {s.intervalHours} hours</option>}
            </select></label>
          <label className="block"><span className="text-xs text-muted-foreground">Keep the newest</span>
            <select value={s.keep} disabled={!s.enabled} onChange={(e) => saveSettings({ keep: Number(e.target.value) })}
              className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring">
              {KEEPS.map((k) => <option key={k} value={k}>{k} backups</option>)}
              {!KEEPS.includes(s.keep) && <option value={s.keep}>{s.keep} backups</option>}
            </select></label>
        </div>
        <p className="text-xs text-muted-foreground/70 pb-3 font-mono truncate" title={data.dir}>{data.dir}</p>
      </div>

      {showList && data.backups.length > 0 && (
        <ul className="border-t border-border/60 divide-y divide-border/60">
          {data.backups.map((b) => (
            <li key={b.name} className="px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{when(b.createdAt)}</p>
                  <p className="text-xs text-muted-foreground truncate">{b.name.includes("before-restore") ? "Safety copy taken before a restore · " : ""}{size(b.size)}</p>
                </div>
                <a href={`/api/admin/backups/${encodeURIComponent(b.name)}`} download title="Download" aria-label="Download backup"
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"><Download className="w-3.5 h-3.5" /></a>
                {data.canRestore && (
                  <button onClick={() => { setRestoring(restoring === b.name ? null : b.name); setPassword(""); }} title="Restore" aria-label="Restore backup"
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"><RotateCcw className="w-3.5 h-3.5" /></button>
                )}
                <button onClick={() => remove(b.name)} title="Delete" aria-label="Delete backup"
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-secondary"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              {restoring === b.name && (
                <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2.5">
                  <p className="text-xs text-amber-400 flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>This replaces <strong>all current data</strong> for everyone with this backup and restarts the server. A safety copy of the current data is saved first. Enter your password to confirm.</span></p>
                  <div className="flex gap-2">
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password"
                      onKeyDown={(e) => { if (e.key === "Enter" && password) restore(); }}
                      className="flex-1 min-w-0 px-3 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                    <button onClick={restore} disabled={!password || restoreBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-500 text-black hover:brightness-110 disabled:opacity-50">
                      {restoreBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Restore
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
