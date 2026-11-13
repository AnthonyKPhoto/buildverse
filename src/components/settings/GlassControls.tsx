"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, RotateCcw, SlidersHorizontal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { usePrefs } from "@/hooks/use-prefs";
import {
  DEFAULT_PREFS, GLASS_LIMITS, getBackgroundImage, setBackgroundImage, setPrefs, type GlassKey,
} from "@/lib/prefs";
import { processBackgroundFile, suggestTint } from "@/lib/background-image";

// Settings → General → "Glass & background": upload your own picture, tint/blur it, and
// tune the glass itself (opacity, blur, saturation, edge shine, shadow, corner roundness).
// Everything applies live — the whole app is the preview.

function Slider({ k, label, hint }: { k: GlassKey; label: string; hint: string }) {
  const prefs = usePrefs();
  const lim = GLASS_LIMITS[k];
  const value = prefs[k];
  const def = DEFAULT_PREFS[k];
  const id = `glass-${k}`;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">{label}</label>
        <span className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
          {value}{lim.unit}
          {value !== def && (
            <button onClick={() => setPrefs({ [k]: def })} title={`Reset to ${def}${lim.unit}`} aria-label={`Reset ${label}`}
              className="p-0.5 rounded-full hover:text-foreground"><RotateCcw className="w-3 h-3" /></button>
          )}
        </span>
      </div>
      <input
        id={id} type="range" min={lim.min} max={lim.max} step={1} value={value}
        aria-valuetext={`${value}${lim.unit === "%" ? " percent" : " pixels"}`}
        onChange={(e) => setPrefs({ [k]: Number(e.target.value) })}
        className="w-full mt-2 h-1.5 cursor-pointer"
        style={{ accentColor: "hsl(var(--theme))" }}
      />
      <p className="text-xs text-muted-foreground mt-1">{hint}</p>
    </div>
  );
}

export function GlassControls() {
  const prefs = usePrefs();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => { setThumb(getBackgroundImage()); }, []);

  const glass = prefs.material !== "classic";
  const usingImage = prefs.bgMode === "image" && !!thumb;

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const res = await processBackgroundFile(file);
      if (!setBackgroundImage(res.dataUrl)) throw new Error("Your browser couldn't store that picture (its storage is full). Try a smaller one.");
      const tint = suggestTint(res.luminance, prefs.material === "light-frosted");
      setPrefs({ bgMode: "image", bgDim: tint });
      setThumb(res.dataUrl);
      toast({ title: "Background set", description: `Tint starts at ${tint}% so text stays readable — adjust it below.` });
    } catch (e) {
      toast({ title: "Couldn't use that picture", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = () => {
    setBackgroundImage(null);
    setPrefs({ bgMode: "mesh" });
    setThumb(null);
  };

  const resetGlass = () => setPrefs({
    glassOpacity: DEFAULT_PREFS.glassOpacity, glassBlur: DEFAULT_PREFS.glassBlur, glassSaturation: DEFAULT_PREFS.glassSaturation,
    glassEdge: DEFAULT_PREFS.glassEdge, glassShadow: DEFAULT_PREFS.glassShadow, glassRadius: DEFAULT_PREFS.glassRadius,
  });

  const seg = (on: boolean) => cn(
    "flex-1 py-2 text-sm font-medium rounded-full border transition-colors",
    on ? "border-theme bg-theme/10 text-theme" : "border-border bg-secondary text-muted-foreground hover:text-foreground"
  );
  const sizeKb = thumb ? Math.round((thumb.length * 0.75) / 1024) : 0;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-theme/10 flex items-center justify-center"><SlidersHorizontal className="w-3.5 h-3.5 text-theme" strokeWidth={2.2} /></div>
          <h3 className="font-semibold text-sm">Glass &amp; background</h3>
        </div>
        <button onClick={resetGlass} disabled={!glass}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border border-border bg-secondary hover:bg-accent disabled:opacity-50">
          <RotateCcw className="w-3 h-3" />Reset glass
        </button>
      </div>

      {!glass && (
        <p className="mx-5 mt-4 text-xs text-muted-foreground rounded-xl border border-border bg-secondary/60 px-3.5 py-2.5">
          Choose <strong>Light Frosted</strong>, <strong>Dark Frosted</strong> or <strong>Clear Crystal</strong> in the pill above to use a custom
          background and tune the glass. These settings are saved and will apply as soon as you do.
        </p>
      )}

      <div className={cn("px-5 py-5 space-y-6", !glass && "opacity-50")} aria-disabled={!glass}>
        {/* ── Background ── */}
        <section aria-label="Background" className="space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Background</p>
          <div className="flex gap-2" role="radiogroup" aria-label="Background source">
            <button role="radio" aria-checked={!usingImage} className={seg(!usingImage)} disabled={!glass}
              onClick={() => setPrefs({ bgMode: "mesh" })}>Theme gradient</button>
            <button role="radio" aria-checked={usingImage} className={seg(usingImage)} disabled={!glass}
              onClick={() => (thumb ? setPrefs({ bgMode: "image" }) : fileRef.current?.click())}>My picture</button>
          </div>

          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="hidden"
            aria-label="Upload background picture" onChange={(e) => handleFile(e.target.files?.[0])} />

          <div
            onDragOver={(e) => { e.preventDefault(); if (glass) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); if (glass) handleFile(e.dataTransfer.files?.[0]); }}
            className={cn("rounded-2xl border border-dashed p-4 transition-colors", dragging ? "border-theme bg-theme/10" : "border-border")}
          >
            {thumb ? (
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumb} alt="Your background" className="w-32 h-20 sm:w-40 sm:h-24 rounded-xl object-cover ring-1 ring-border shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Your picture</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{sizeKb} KB · saved on this device only — it&apos;s never uploaded.</p>
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    <button onClick={() => fileRef.current?.click()} disabled={!glass || busy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-border bg-secondary hover:bg-accent disabled:opacity-50">
                      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}Replace
                    </button>
                    <button onClick={remove} disabled={!glass}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-border bg-secondary hover:text-destructive disabled:opacity-50">
                      <Trash2 className="w-3 h-3" />Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} disabled={!glass || busy}
                className="w-full flex flex-col items-center gap-2 py-5 text-center disabled:cursor-not-allowed">
                {busy ? <Loader2 className="w-6 h-6 animate-spin text-theme" /> : <ImagePlus className="w-6 h-6 text-theme" />}
                <span className="text-sm font-medium">{busy ? "Preparing your picture…" : "Choose a picture, or drop one here"}</span>
                <span className="text-xs text-muted-foreground">PNG, JPEG, WebP or AVIF · resized and kept on this device only</span>
              </button>
            )}
          </div>

          {usingImage && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
              <Slider k="bgDim" label="Tint" hint="Darkens (or, on Light Frosted, whitens) the picture so text stays readable." />
              <Slider k="bgBlur" label="Picture blur" hint="Softens the picture itself, separate from the glass blur." />
            </div>
          )}
        </section>

        {/* ── Glass ── */}
        <section aria-label="Glass" className="space-y-5 pt-5 border-t border-border/60">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Glass</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            <Slider k="glassOpacity" label="Opacity" hint="Lower is more see-through; higher is more solid." />
            <Slider k="glassBlur" label="Blur" hint="How much the background is frosted behind each panel." />
            <Slider k="glassSaturation" label="Colour boost" hint="Vibrancy of whatever shows through the glass." />
            <Slider k="glassEdge" label="Edge shine" hint="Brightness of the light-catching border and top highlight." />
            <Slider k="glassShadow" label="Shadow depth" hint="How far panels appear to float above the background." />
            <Slider k="glassRadius" label="Corner roundness" hint="Radius of cards and panels (modals are slightly rounder)." />
          </div>
        </section>
      </div>
    </div>
  );
}
