"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  getPrefs, setPrefs, UI_SCALES, SIDEBAR_WIDTHS, CURRENCIES, DATE_FORMATS, type Prefs,
} from "@/lib/prefs";

// Extra display customization shown inside Settings → General → Appearance.
// Interface size, sidebar width and reduce-motion apply instantly. Currency,
// cents and date format are read inside formatCurrency()/formatDate() at render
// time, so after changing one we reload to re-render everything consistently.

const LABEL = "text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3";

function Segmented<T extends string>({ value, options, onChange }: {
  value: T; options: { id: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "flex-1 py-2 text-xs font-medium border rounded-xl transition-all duration-150",
            value === o.id ? "border-theme bg-theme/10 text-theme" : "border-border bg-secondary text-muted-foreground hover:border-border/80 hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={cn("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none",
        on ? "bg-theme" : "bg-secondary border border-border")}
    >
      <span className={cn("inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200", on ? "translate-x-4" : "translate-x-0.5")} />
    </button>
  );
}

export function AppearanceExtras() {
  const [prefs, setLocal] = useState<Prefs>(() => getPrefs());

  const change = (partial: Partial<Prefs>, reload = false) => {
    setLocal(setPrefs(partial) ?? prefs);
    // Give the account save a moment to leave before the page reloads
    if (reload) setTimeout(() => window.location.reload(), 350);
  };

  return (
    <>
      <div className="mt-5">
        <p className={LABEL}>Interface size</p>
        <Segmented value={prefs.uiScale} options={UI_SCALES} onChange={(v) => change({ uiScale: v })} />
        <p className="text-xs text-muted-foreground mt-2">Scales text and spacing everywhere. Compact fits more on screen.</p>
      </div>

      <div className="mt-5">
        <p className={LABEL}>Sidebar width</p>
        <Segmented value={prefs.sidebarWidth} options={SIDEBAR_WIDTHS} onChange={(v) => change({ sidebarWidth: v })} />
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Reduce motion</p>
          <p className="text-xs text-muted-foreground mt-0.5">Turns off animations and transitions. Also follows your system setting.</p>
        </div>
        <Switch on={prefs.reduceMotion} onChange={(v) => change({ reduceMotion: v })} label="Reduce motion" />
      </div>

      <div className="mt-6 pt-5 border-t border-border/60">
        <p className={LABEL}>Currency &amp; dates</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-muted-foreground">Currency</span>
            <select
              value={prefs.currency}
              onChange={(e) => change({ currency: e.target.value as Prefs["currency"] }, true)}
              className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {CURRENCIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Date format</span>
            <select
              value={prefs.dateFormat}
              onChange={(e) => change({ dateFormat: e.target.value as Prefs["dateFormat"] }, true)}
              className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {DATE_FORMATS.map((d) => <option key={d.id} value={d.id}>{d.label} — {d.example}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Show cents</p>
            <p className="text-xs text-muted-foreground mt-0.5">$1,299.99 instead of $1,300 in totals and lists. (Product prices always show cents.)</p>
          </div>
          <Switch on={prefs.showCents} onChange={(v) => change({ showCents: v }, true)} label="Show cents" />
        </div>
        <p className="text-xs text-muted-foreground/70 mt-3">This only changes how amounts are displayed — no values are converted.</p>
      </div>
    </>
  );
}
