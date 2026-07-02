"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, CheckCircle2, ArrowRight, ChevronRight } from "lucide-react";
import { ACCENT_PRESETS, applyAccent } from "@/components/ThemeProvider";

const GDRIVE_CLIENT_ID = "874903401741-bkbf6fjgq04583agk60o1vgi0iv4j34v.apps.googleusercontent.com";
const STORAGE_KEY = "bv_setup_complete";

type Step = "welcome" | "appearance" | "sync" | "done";

export function SetupWizard() {
  const [visible, setVisible] = useState(false);
  const [step,    setStep]    = useState<Step>("welcome");
  const [accent,  setAccent]  = useState("blue");
  const [syncChoice, setSyncChoice] = useState<"gdrive" | "local" | null>(null);
  const [gdriveEmail,   setGdriveEmail]   = useState<string | null>(null);
  const [gdriveWaiting, setGdriveWaiting] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    // Pre-fill accent from saved prefs
    const saved = localStorage.getItem("bv-accent");
    if (saved) setAccent(saved);
  }, []);

  // Poll for Google Drive connection when waiting
  useEffect(() => {
    if (!gdriveWaiting) return;
    const iv = setInterval(async () => {
      try {
        const s = await fetch("/api/gdrive").then(r => r.json()) as { connected: boolean; email?: string };
        if (s.connected) {
          setGdriveEmail(s.email ?? "");
          setGdriveWaiting(false);
          clearInterval(iv);
        }
      } catch { /* ignore */ }
    }, 2000);
    const timeout = setTimeout(() => { clearInterval(iv); setGdriveWaiting(false); }, 5 * 60 * 1000);
    return () => { clearInterval(iv); clearTimeout(timeout); };
  }, [gdriveWaiting]);

  const pickAccent = (id: string) => {
    setAccent(id);
    applyAccent(id);
    localStorage.setItem("bv-accent", id);
  };

  const connectGoogle = () => {
    const path = `/api/oauth/google/start?client_id=${encodeURIComponent(GDRIVE_CLIENT_ID)}`;
    if (window.electronAPI?.openExternal) {
      const port = window.location.port || "3456";
      window.electronAPI.openExternal(`http://127.0.0.1:${port}${path}`);
    } else {
      window.location.href = path;
    }
    setGdriveWaiting(true);
  };

  const restoreFromDrive = async () => {
    setImporting(true);
    try {
      const res = await fetch("/api/gdrive", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "download" }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error);
    } catch { /* non-fatal in setup */ }
    setImporting(false);
  };

  const finish = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }, []);

  if (!visible) return null;

  const STEPS: Step[] = ["welcome", "appearance", "sync", "done"];
  const stepIdx = STEPS.indexOf(step);

  const next = () => {
    const n = STEPS[stepIdx + 1];
    if (n) setStep(n);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background">
      {/* Progress dots */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className={`h-1.5 rounded-full transition-all ${i === stepIdx ? "w-6 bg-theme" : i < stepIdx ? "w-1.5 bg-theme/40" : "w-1.5 bg-border"}`} />
        ))}
      </div>

      <div className="w-full max-w-md px-6">

        {/* ── Welcome ─────────────────────────────────── */}
        {step === "welcome" && (
          <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="w-20 h-20 rounded-2xl bg-theme/10 border border-theme/20 flex items-center justify-center mx-auto">
              <span className="text-4xl">🔧</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome to BuildVerse</h1>
              <p className="text-muted-foreground">Your intelligent vehicle modification manager. Let&apos;s get you set up in about 30 seconds.</p>
            </div>
            <button onClick={next} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-theme text-white font-semibold text-sm hover:brightness-110 transition-all">
              Get Started <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={finish} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Skip setup
            </button>
          </div>
        )}

        {/* ── Appearance ──────────────────────────────── */}
        {step === "appearance" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div>
              <h2 className="text-2xl font-bold mb-1">Pick your color</h2>
              <p className="text-sm text-muted-foreground">You can always change this later in Settings.</p>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {ACCENT_PRESETS.map(p => (
                <button key={p.id} onClick={() => pickAccent(p.id)} title={p.label}
                  className={`w-full aspect-square rounded-xl border-2 transition-all ${accent === p.id ? "border-white scale-110 shadow-lg" : "border-transparent hover:scale-105"}`}
                  style={{ background: p.hex }}
                />
              ))}
            </div>
            <div className="p-3.5 rounded-xl border border-border bg-secondary/40 text-sm text-muted-foreground">
              Selected: <span className="font-medium text-foreground">{ACCENT_PRESETS.find(p => p.id === accent)?.label}</span>
            </div>
            <button onClick={next} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-theme text-white font-semibold text-sm hover:brightness-110 transition-all">
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Sync ────────────────────────────────────── */}
        {step === "sync" && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div>
              <h2 className="text-2xl font-bold mb-1">How do you want to sync?</h2>
              <p className="text-sm text-muted-foreground">Keep your data backed up and accessible across devices.</p>
            </div>

            <div className="space-y-2">
              {/* Google Drive option */}
              <button onClick={() => setSyncChoice("gdrive")}
                className={`w-full flex items-start gap-3.5 p-4 rounded-xl border text-left transition-colors ${syncChoice === "gdrive" ? "border-theme bg-theme/5" : "border-border bg-secondary/40 hover:border-border/80"}`}>
                <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${syncChoice === "gdrive" ? "border-theme bg-theme" : "border-border/80"}`}>
                  {syncChoice === "gdrive" && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div>
                  <p className="text-sm font-semibold">Google Drive</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Automatic backup to your private Drive folder. Sign in with Google — takes 10 seconds.</p>
                </div>
              </button>

              {/* Local only option */}
              <button onClick={() => { setSyncChoice("local"); localStorage.setItem("bv_sync_method", "server"); }}
                className={`w-full flex items-start gap-3.5 p-4 rounded-xl border text-left transition-colors ${syncChoice === "local" ? "border-theme bg-theme/5" : "border-border bg-secondary/40 hover:border-border/80"}`}>
                <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${syncChoice === "local" ? "border-theme bg-theme" : "border-border/80"}`}>
                  {syncChoice === "local" && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div>
                  <p className="text-sm font-semibold">Keep local</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Data stays on this device only. You can always set up sync later in Settings.</p>
                </div>
              </button>
            </div>

            {/* Google Drive sign-in */}
            {syncChoice === "gdrive" && (
              <div className="pt-1">
                {gdriveEmail ? (
                  <div className="flex items-center gap-3 p-3.5 rounded-xl border border-green-500/30 bg-green-500/5">
                    <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-400">Connected</p>
                      <p className="text-xs text-muted-foreground">{gdriveEmail}</p>
                    </div>
                    {!importing && (
                      <button onClick={restoreFromDrive} className="ml-auto text-xs text-theme hover:underline">
                        Restore data?
                      </button>
                    )}
                    {importing && <Loader2 className="ml-auto w-4 h-4 animate-spin" />}
                  </div>
                ) : gdriveWaiting ? (
                  <div className="flex items-center gap-3 p-3.5 rounded-xl border border-theme/30 bg-theme/5">
                    <Loader2 className="w-4 h-4 animate-spin text-theme shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Waiting for sign-in…</p>
                      <p className="text-xs text-muted-foreground">Complete the sign-in in your browser.</p>
                    </div>
                    <button onClick={() => setGdriveWaiting(false)} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                  </div>
                ) : (
                  <button onClick={connectGoogle}
                    className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white text-gray-700 text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm">
                    <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                    Sign in with Google
                  </button>
                )}
              </div>
            )}

            <button
              onClick={() => {
                if (syncChoice === "gdrive") localStorage.setItem("bv_sync_method", "gdrive");
                next();
              }}
              disabled={!syncChoice}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-theme text-white font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={next} className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center">
              Skip for now
            </button>
          </div>
        )}

        {/* ── Done ────────────────────────────────────── */}
        {step === "done" && (
          <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">You&apos;re all set!</h2>
              <p className="text-muted-foreground text-sm">Your BuildVerse is ready. Add your first vehicle to start tracking your build.</p>
            </div>
            <div className="p-3.5 rounded-xl border border-border bg-secondary/40 text-left space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Your setup</p>
              <p className="text-sm">Color: <span className="font-medium">{ACCENT_PRESETS.find(p => p.id === accent)?.label}</span></p>
              <p className="text-sm">Sync: <span className="font-medium">{gdriveEmail ? `Google Drive (${gdriveEmail})` : syncChoice === "gdrive" ? "Google Drive (not connected)" : "Local only"}</span></p>
            </div>
            <button onClick={finish} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-theme text-white font-semibold text-sm hover:brightness-110 transition-all">
              Go to My Garage <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
