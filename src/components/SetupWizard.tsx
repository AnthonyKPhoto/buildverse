"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { CheckCircle2, ArrowRight, ChevronRight } from "lucide-react";
import { ACCENT_PRESETS, applyAccent } from "@/components/ThemeProvider";

const STORAGE_KEY = "bv_setup_complete";

type Step = "welcome" | "appearance" | "done";

export function SetupWizard() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [step,    setStep]    = useState<Step>("welcome");
  const [accent,  setAccent]  = useState("blue");

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    // Pre-fill accent from saved prefs
    const saved = localStorage.getItem("bv-accent");
    if (saved) setAccent(saved);
  }, []);

  const pickAccent = (id: string) => {
    setAccent(id);
    applyAccent(id);
    localStorage.setItem("bv-accent", id);
  };

  const finish = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }, []);

  // Never show this over the login/setup/change-password screens — it's
  // local-only "welcome to the app" onboarding (tracked per-browser via
  // localStorage) and its z-[200] would otherwise sit on top of their z-50
  // overlays, blocking those flows for any browser profile that hasn't
  // dismissed it yet.
  if (!visible || pathname === "/login" || pathname === "/change-password") return null;

  const STEPS: Step[] = ["welcome", "appearance", "done"];
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
              <p className="text-sm">Want to sync across devices? Set up a server connection any time in Settings → Access &amp; Sync.</p>
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
