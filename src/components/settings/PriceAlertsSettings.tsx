"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Mail, Send, Loader2, RefreshCw, AlertCircle, CheckCircle2, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface AlertSettings {
  emailEnabled: boolean; recipients: string[]; autoCheck: boolean; intervalHours: number; dropPercent: number;
  smtpConfigured: boolean; effectiveRecipientCount: number; canEdit: boolean;
}

const INTERVALS = [
  { h: 1, label: "Every hour" }, { h: 3, label: "Every 3 hours" }, { h: 6, label: "Every 6 hours" },
  { h: 12, label: "Every 12 hours" }, { h: 24, label: "Daily" }, { h: 72, label: "Every 3 days" }, { h: 168, label: "Weekly" },
];

function Switch({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={cn("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50",
        on ? "bg-theme" : "bg-secondary border border-border")}
    >
      <span className={cn("inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200", on ? "translate-x-4" : "translate-x-0.5")} />
    </button>
  );
}

function Row({ label, desc, children, last }: { label: string; desc?: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-3", !last && "border-b border-border/60")}>
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  );
}


interface SmtpState { host: string; port: number; secure: boolean; username: string; from: string; hasPassword: boolean }

// Compact email-server setup so alerts can be configured in one place — and so
// desktop (local-mode) users, who don't get the server-only "Access & Sync" tab,
// can set it up at all. Talks to the same endpoint as that tab.
function SmtpCard({ canEdit, onSaved, startOpen }: { canEdit: boolean; onSaved: () => void; startOpen: boolean }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(startOpen);
  const [f, setF] = useState({ host: "", port: 587, secure: false, username: "", password: "", from: "" });
  const [hasPassword, setHasPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings/smtp").then((r) => (r.ok ? r.json() : null)).then((d: SmtpState | null) => {
      if (d) { setF((x) => ({ ...x, host: d.host, port: d.port, secure: d.secure, username: d.username, from: d.from })); setHasPassword(d.hasPassword); }
    }).catch(() => {});
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings/smtp", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: f.host, port: f.port, secure: f.secure, username: f.username, from: f.from, ...(f.password ? { password: f.password } : {}) }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setHasPassword(d.hasPassword); setF((x) => ({ ...x, password: "" }));
      toast({ title: "Email server saved" });
      onSaved();
    } catch (err) {
      toast({ title: "Couldn't save", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const input = "w-full px-3 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring";
  return (
    <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-5 py-4 text-left" aria-expanded={open}>
        <span className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-theme/10 flex items-center justify-center"><Send className="w-3.5 h-3.5 text-theme" strokeWidth={2.2} /></span>
          <span className="font-semibold text-sm">Email server (SMTP)</span>
        </span>
        <span className="text-xs text-muted-foreground">{hasPassword && f.host ? `Connected to ${f.host}` : "Not set up"} · {open ? "hide" : "edit"}</span>
      </button>
      {open && (
        <form onSubmit={save} className="px-5 pb-5 pt-1 space-y-3 border-t border-border/60">
          <p className="text-xs text-muted-foreground pt-3">
            Use any provider that offers SMTP. Gmail and Outlook need an <strong>app password</strong>, not your normal one.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="sm:col-span-2 block"><span className="text-xs text-muted-foreground">Host</span>
              <input className={input} required disabled={!canEdit} value={f.host} onChange={(e) => setF({ ...f, host: e.target.value })} placeholder="smtp.gmail.com" /></label>
            <label className="block"><span className="text-xs text-muted-foreground">Port</span>
              <input className={input} type="number" required disabled={!canEdit} value={f.port} onChange={(e) => setF({ ...f, port: Number(e.target.value) })} /></label>
            <label className="block"><span className="text-xs text-muted-foreground">Username</span>
              <input className={input} required disabled={!canEdit} value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoComplete="off" /></label>
            <label className="block"><span className="text-xs text-muted-foreground">Password</span>
              <input className={input} type="password" disabled={!canEdit} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder={hasPassword ? "•••••••• (unchanged)" : ""} autoComplete="new-password" /></label>
            <label className="block"><span className="text-xs text-muted-foreground">From</span>
              <input className={input} required disabled={!canEdit} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} placeholder="BuildVerse <you@example.com>" /></label>
          </div>
          <div className="flex items-center justify-between gap-3 pt-1">
            <label className="flex items-center gap-2 text-sm"><Switch on={f.secure} disabled={!canEdit} onChange={(v) => setF({ ...f, secure: v })} label="Implicit TLS" />
              <span>Implicit TLS <span className="text-xs text-muted-foreground">(port 465)</span></span></label>
            <button disabled={saving || !canEdit} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-theme text-white hover:brightness-110 disabled:opacity-50">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Save
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function PriceAlertsSettings() {
  const { toast } = useToast();
  const [s, setS] = useState<AlertSettings | null>(null);
  const [recipientInput, setRecipientInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [checking, setChecking] = useState(false);

  const load = useCallback(() =>
    fetch("/api/products/settings").then((r) => r.json()).then(setS).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const save = async (patch: Partial<AlertSettings>) => {
    if (!s) return;
    setSaving(true);
    const prev = s;
    setS({ ...s, ...patch });
    try {
      const res = await fetch("/api/products/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setS(data);
    } catch (e) {
      setS(prev);
      toast({ title: "Couldn't save", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addRecipient = () => {
    const v = recipientInput.trim();
    if (!v || !s) return;
    if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(v)) {
      toast({ title: "That doesn't look like an email address", variant: "destructive" });
      return;
    }
    if (!s.recipients.includes(v)) save({ recipients: [...s.recipients, v] });
    setRecipientInput("");
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/products/settings/test", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Test email sent", description: "Check your inbox (and spam folder)." });
    } catch (e) {
      toast({ title: "Test email failed", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const checkNow = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/products/check", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      if (d.skipped === "busy") toast({ title: "A check is already running" });
      else toast({
        title: `Checked ${d.checked} product${d.checked === 1 ? "" : "s"}`,
        description: [
          d.failed ? `${d.failed} had problems` : null,
          d.alerts ? (d.emailed ? `${d.alerts} alert email sent` : `${d.alerts} alert(s) — email not sent${d.emailError ? `: ${d.emailError}` : ""}`) : "No new alerts",
        ].filter(Boolean).join(" · "),
      });
    } catch (e) {
      toast({ title: "Check failed", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  if (!s) return <div className="flex items-center gap-2 text-sm text-muted-foreground py-8"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div>;
  const ro = !s.canEdit;

  return (
    <div className="space-y-5">
      {ro && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-secondary/60 border border-border text-sm text-muted-foreground">
          <AlertCircle className="w-4 h-4 shrink-0" /> Only an admin can change price alert settings.
        </div>
      )}

      {/* Background checking */}
      <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
          <div className="w-7 h-7 rounded-lg bg-theme/10 flex items-center justify-center"><RefreshCw className="w-3.5 h-3.5 text-theme" strokeWidth={2.2} /></div>
          <h3 className="font-semibold text-sm">Automatic price checks</h3>
        </div>
        <div className="px-5 py-1">
          <Row label="Check prices in the background" desc="Keeps prices fresh even when BuildVerse isn't open on your screen. Needed for email alerts.">
            <Switch on={s.autoCheck} disabled={ro} onChange={(v) => save({ autoCheck: v })} label="Automatic checks" />
          </Row>
          <Row label="How often" desc="Each product is re-checked this often. Longer is gentler on the shops." last>
            <select
              value={s.intervalHours} disabled={ro || !s.autoCheck}
              onChange={(e) => save({ intervalHours: Number(e.target.value) })}
              className="px-3 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            >
              {INTERVALS.map((i) => <option key={i.h} value={i.h}>{i.label}</option>)}
            </select>
          </Row>
        </div>
      </div>

      {/* Email */}
      <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-theme/10 flex items-center justify-center"><Mail className="w-3.5 h-3.5 text-theme" strokeWidth={2.2} /></div>
            <h3 className="font-semibold text-sm">Email alerts</h3>
          </div>
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        </div>
        <div className="px-5 py-1">
          {!s.smtpConfigured && (
            <div className="my-3 flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
              <span>
                Email isn&apos;t set up yet. Add your email server details in the <strong>Email server (SMTP)</strong> box below
                — alerts can&apos;t be sent without them.
              </span>
            </div>
          )}
          <Row label="Email me when a price alert triggers" desc="Off by default. You also choose which products email you, from the tracker page.">
            <Switch on={s.emailEnabled} disabled={ro} onChange={(v) => save({ emailEnabled: v })} label="Email alerts" />
          </Row>

          <div className={cn("py-3 border-b border-border/60", !s.emailEnabled && "opacity-50")}>
            <p className="text-sm font-medium">Send to</p>
            <p className="text-xs text-muted-foreground mt-0.5 mb-2.5">
              {s.recipients.length === 0
                ? "No address added — emails go to admin accounts that have an email on file."
                : "Everyone below gets a single digest email per check."}
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {s.recipients.map((r) => (
                <span key={r} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-secondary border border-border text-xs">
                  {r}
                  {!ro && (
                    <button onClick={() => save({ recipients: s.recipients.filter((x) => x !== r) })} className="text-muted-foreground hover:text-destructive" aria-label={`Remove ${r}`}>
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {!ro && (
              <div className="flex gap-2">
                <input
                  type="email" placeholder="you@example.com" value={recipientInput} disabled={!s.emailEnabled}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addRecipient(); }}
                  className="flex-1 min-w-0 px-3 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button onClick={addRecipient} disabled={!recipientInput.trim() || !s.emailEnabled}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-border bg-secondary hover:bg-accent disabled:opacity-50">
                  <Plus className="w-3.5 h-3.5" />Add
                </button>
              </div>
            )}
          </div>

          <Row label="Also email on big drops" desc="Notify when any email-enabled product falls by at least this much since its last check, even without a target price.">
            <div className="flex items-center gap-1.5">
              <select
                value={s.dropPercent} disabled={ro || !s.emailEnabled}
                onChange={(e) => save({ dropPercent: Number(e.target.value) })}
                className="px-3 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              >
                <option value={0}>Off</option>
                {[5, 10, 15, 20, 30, 50].map((p) => <option key={p} value={p}>{p}% or more</option>)}
              </select>
            </div>
          </Row>

          <div className="py-3.5 flex flex-wrap items-center gap-2">
            <button onClick={sendTest} disabled={testing || ro || !s.smtpConfigured || s.effectiveRecipientCount === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-border bg-secondary hover:bg-accent disabled:opacity-50 disabled:pointer-events-none">
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}Send test email
            </button>
            <button onClick={checkNow} disabled={checking || ro}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-theme text-white hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none">
              {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}Check all prices now
            </button>
            {s.emailEnabled && s.smtpConfigured && s.effectiveRecipientCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-green-400"><CheckCircle2 className="w-3.5 h-3.5" />Ready — {s.effectiveRecipientCount} recipient{s.effectiveRecipientCount === 1 ? "" : "s"}</span>
            )}
          </div>
        </div>
      </div>

      <SmtpCard canEdit={s.canEdit} onSaved={load} startOpen={!s.smtpConfigured} />

      <p className="text-xs text-muted-foreground px-1 flex items-center gap-1.5">
        <Bell className="w-3 h-3" /> Set target prices and pick which products email you on the{" "}
        <Link href="/products" className="text-theme hover:underline">Product Tracker</Link>.
      </p>
    </div>
  );
}
