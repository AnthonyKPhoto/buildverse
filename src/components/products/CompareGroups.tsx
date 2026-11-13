"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, Scale, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn, formatPrice } from "@/lib/utils";
import { TrackedProduct, isOutOfStock, rankGroup, timeAgo } from "./types";

// One table per comparison group: the same part tracked at several shops, ranked
// cheapest-first among what's actually in stock.

export function CompareGroups({ groups }: { groups: Map<string, TrackedProduct[]> }) {
  const [open, setOpen] = useState(true);
  const multi = Array.from(groups.values()).filter((m) => m.length > 1);
  if (multi.length === 0) return null;

  return (
    <section aria-label="Shop comparisons" className="space-y-3">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 text-sm font-semibold" aria-expanded={open}>
        <Scale className="w-4 h-4 text-theme" />
        Shop comparisons
        <span className="text-xs font-normal text-muted-foreground">{multi.length} part{multi.length === 1 ? "" : "s"}</span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
          {multi.map((members) => {
            const ranked = rankGroup(members);
            const best = ranked[0];
            const bestPrice = best?.currentPrice ?? null;
            const priced = ranked.filter((p) => p.currentPrice != null);
            const spread = priced.length > 1 ? (priced[priced.length - 1].currentPrice as number) - (priced[0].currentPrice as number) : 0;
            const name = members[0].compareGroup!;
            return (
              <Card key={name.toLowerCase()} className="overflow-hidden">
                <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {members.length} shops
                      {bestPrice != null && best && !isOutOfStock(best) && <> · best <span className="text-green-400 font-medium tabular-nums">{formatPrice(bestPrice)}</span> at {best.vendor ?? "one shop"}</>}
                      {spread > 0.5 && <> · up to {formatPrice(spread)} difference</>}
                    </p>
                  </div>
                </div>
                <ul className="divide-y divide-border/60">
                  {ranked.map((p, i) => {
                    const out = isOutOfStock(p);
                    const isBest = i === 0 && !out && p.currentPrice != null;
                    const extra = p.currentPrice != null && bestPrice != null ? p.currentPrice - bestPrice : 0;
                    return (
                      <li key={p.id} className={cn("px-4 py-2.5 flex items-center gap-3", isBest && "bg-amber-500/[0.06]", out && "opacity-60")}>
                        <span className="w-5 shrink-0 text-center">
                          {isBest ? <Trophy className="w-4 h-4 text-amber-400 inline" aria-label="Best price" /> : <span className="text-xs text-muted-foreground tabular-nums">{i + 1}</span>}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{p.vendor ?? new URL(p.url).hostname}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {p.availability ?? "Stock unknown"} · checked {timeAgo(p.lastChecked)}
                            {p.lastError && <span className="text-amber-400"> · couldn&apos;t update</span>}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={cn("text-sm font-bold tabular-nums", isBest && "text-green-400")}>{formatPrice(p.currentPrice)}</p>
                          {!isBest && extra > 0.004 && <p className="text-[11px] text-muted-foreground tabular-nums">+{formatPrice(extra)}</p>}
                        </div>
                        <a href={p.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${p.vendor ?? "product"} page`}
                          className="text-muted-foreground hover:text-theme shrink-0"><ExternalLink className="w-3.5 h-3.5" /></a>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
