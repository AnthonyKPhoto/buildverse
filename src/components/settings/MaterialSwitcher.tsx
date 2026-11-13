"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { MATERIALS, setPrefs, type Material } from "@/lib/prefs";
import { usePrefs } from "@/hooks/use-prefs";

/**
 * Floating pill that switches the app's surface material:
 * Classic (the existing look) · Light Frosted · Dark Frosted · Clear Crystal.
 *
 * A single accent-coloured thumb slides between the options. Sticky, so it stays
 * in view while you scroll the settings and watch the whole UI re-skin live.
 * Arrow keys move between options (standard radio-group behaviour).
 */
export function MaterialSwitcher() {
  const { material } = usePrefs();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, MATERIALS.findIndex((m) => m.id === material));
  const active = MATERIALS[index];

  const choose = (id: Material, focusIndex?: number) => {
    setPrefs({ material: id });
    if (focusIndex !== undefined) refs.current[focusIndex]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const last = MATERIALS.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = i === last ? 0 : i + 1;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = i === 0 ? last : i - 1;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = last;
    if (next !== null) { e.preventDefault(); choose(MATERIALS[next].id, next); }
  };

  return (
    <div className="sticky top-3 z-30 flex flex-col items-center gap-2">
      <div
        role="radiogroup" aria-label="Appearance material"
        className="relative grid grid-cols-4 w-full max-w-2xl p-1 rounded-full border border-border bg-secondary/70 backdrop-blur-xl shadow-lg shadow-black/20"
      >
        {/* sliding thumb */}
        <span
          aria-hidden
          className="absolute top-1 bottom-1 left-1 rounded-full bg-theme shadow-md transition-transform duration-300 ease-out"
          style={{
            width: `calc((100% - 0.5rem) / ${MATERIALS.length})`,
            transform: `translateX(${index * 100}%)`,
            backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0) 65%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 14px hsl(var(--theme) / 0.45)",
          }}
        />
        {MATERIALS.map((m, i) => {
          const on = i === index;
          return (
            <button
              key={m.id}
              ref={(el) => { refs.current[i] = el; }}
              role="radio" aria-checked={on} tabIndex={on ? 0 : -1} title={m.hint}
              onClick={() => choose(m.id)} onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "relative z-10 flex items-center justify-center gap-2 px-2 py-2 rounded-full text-xs sm:text-sm font-medium",
                "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                on ? "text-white" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span aria-hidden className="hidden sm:block w-3.5 h-3.5 rounded-full shrink-0 ring-1 ring-white/40" style={{ background: m.swatch }} />
              <span className="truncate">{m.label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">{active.hint}</p>
    </div>
  );
}
