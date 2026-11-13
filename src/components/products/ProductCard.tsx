"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, BellOff, CheckCircle2, ChevronDown, Clock,
  ExternalLink, Mail, MailCheck, Package, RefreshCw, Trash2, TrendingDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatPrice } from "@/lib/utils";
import { AlertSettingsLite, TrackedProduct, isAlertHit, isDropped, isOutOfStock, timeAgo } from "./types";

interface Props {
  product: TrackedProduct;
  settings: AlertSettingsLite | null;
  refreshing: boolean;
  onRefresh: () => void;
  onDelete: () => void;
  onSaveAlert: (patch: { alertThreshold?: number | null; notifyEmail?: boolean }) => Promise<void>;
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: 12,
};

export function ProductCard({ product: p, settings, refreshing, onRefresh, onDelete, onSaveAlert }: Props) {
  const [open, setOpen] = useState(false);          // details (full chart)
  const [alertOpen, setAlertOpen] = useState(false); // alert editor
  const [target, setTarget] = useState(p.alertThreshold != null ? String(p.alertThreshold) : "");
  const [saving, setSaving] = useState(false);

  const hit = isAlertHit(p);
  const dropped = isDropped(p);
  const atLow = p.currentPrice != null && p.lowestPrice != null && p.highestPrice != null
    && p.lowestPrice !== p.highestPrice && p.currentPrice <= p.lowestPrice;
  const outOfStock = isOutOfStock(p);
  const delta = dropped || (p.previousPrice != null && p.currentPrice != null && p.currentPrice > p.previousPrice + 0.004)
    ? (p.currentPrice! - p.previousPrice!) : null;
  const offPeak = p.highestPrice != null && p.currentPrice != null && p.currentPrice < p.highestPrice
    ? Math.round(((p.highestPrice - p.currentPrice) / p.highestPrice) * 100) : 0;

  const history = [...p.priceHistory]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((h) => ({ date: new Date(h.createdAt).toLocaleDateString(), price: h.price }));
  const gid = `spark-${p.id}`;

  const saveTarget = async (value: number | null) => {
    setSaving(true);
    try { await onSaveAlert({ alertThreshold: value }); if (value == null) setTarget(""); }
    finally { setSaving(false); }
  };
  const quickTarget = (pct: number) => {
    if (p.currentPrice != null) setTarget((p.currentPrice * (1 - pct / 100)).toFixed(2));
  };

  const stripe = hit ? "bg-green-400" : dropped ? "bg-green-400/60" : p.lastError ? "bg-amber-400/70" : "bg-theme/40";
  const emailOn = !!p.notifyEmail;

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-200 hover:-translate-y-px hover:shadow-lg hover:shadow-black/25 hover:border-theme/30",
      hit && "border-green-500/30"
    )}>
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px]", stripe)} />
      <CardContent className="p-4 pl-5">
        {/* Top: image · title · price */}
        <div className="flex items-start gap-3.5">
          <div className="w-[72px] h-[72px] rounded-xl overflow-hidden shrink-0 bg-secondary ring-1 ring-border/60 flex items-center justify-center">
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrl} alt="" className="object-cover w-full h-full" referrerPolicy="no-referrer"
                onError={(e) => { e.currentTarget.style.display = "none"; }} />
            ) : (
              <Package className="w-7 h-7 text-muted-foreground/30" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <a href={p.url} target="_blank" rel="noopener noreferrer"
              className="font-semibold text-sm leading-snug line-clamp-2 hover:text-theme transition-colors" title={p.title}>
              {p.title}
            </a>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {[p.vendor, p.brand, p.sku && `SKU ${p.sku}`].filter(Boolean).join(" · ")}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {hit && <Badge className="text-[11px] bg-green-500/15 text-green-400 border-green-500/30 gap-1"><Bell className="w-3 h-3" />Target hit</Badge>}
              {atLow && !hit && <Badge className="text-[11px] bg-green-500/15 text-green-400 border-green-500/30 gap-1"><CheckCircle2 className="w-3 h-3" />Lowest yet</Badge>}
              {offPeak >= 5 && <Badge className="text-[11px] bg-blue-500/15 text-blue-400 border-blue-500/30 gap-1"><TrendingDown className="w-3 h-3" />{offPeak}% off peak</Badge>}
              {p.availability && (
                <Badge className={cn("text-[11px]", outOfStock
                  ? "bg-red-500/15 text-red-400 border-red-500/30"
                  : "bg-secondary text-muted-foreground border-border")}>
                  {p.availability}
                </Badge>
              )}
            </div>
          </div>

          <div className="text-right shrink-0">
            <p className="text-xl font-bold tabular-nums leading-none">{formatPrice(p.currentPrice)}</p>
            {delta != null && (
              <p className={cn("mt-1.5 inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
                delta < 0 ? "text-green-400" : "text-red-400")}>
                {delta < 0 ? <ArrowDownRight className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                {formatPrice(Math.abs(delta))}
              </p>
            )}
            {p.alertThreshold != null && (
              <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">Target {formatPrice(p.alertThreshold)}</p>
            )}
          </div>
        </div>

        {/* Sparkline */}
        {history.length > 1 ? (
          <div className="mt-3 -mx-1">
            <ResponsiveContainer width="100%" height={44}>
              <AreaChart data={history} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                <defs>
                  <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--theme))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--theme))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                {/* Fit the Y range to this product's own prices — otherwise it starts at $0 and every line looks flat */}
                <YAxis hide domain={[(min: number) => min - (min * 0.01 || 1), (max: number) => max + (max * 0.01 || 1)]} />
                <Area type="monotone" dataKey="price" stroke="hsl(var(--theme))" strokeWidth={1.75} fill={`url(#${gid})`} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="mt-3 h-[44px] rounded-lg border border-dashed border-border/60 flex items-center justify-center text-[11px] text-muted-foreground/60">
            Price history builds up as the price is checked
          </div>
        )}

        {p.lastError && (
          <div className="mt-2.5 flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span className="min-w-0">Couldn&apos;t update the price — {p.lastError}. Showing the last known price.</span>
          </div>
        )}

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
            <Clock className="w-3 h-3 shrink-0" />
            <span className="truncate">Checked {timeAgo(p.lastChecked)}</span>
            {p.lowestPrice != null && p.highestPrice != null && p.lowestPrice !== p.highestPrice && (
              <span className="hidden sm:inline text-muted-foreground/70 truncate tabular-nums">
                · Low <span className="text-green-400">{formatPrice(p.lowestPrice)}</span> · High <span className="text-red-400">{formatPrice(p.highestPrice)}</span>
              </span>
            )}
          </span>

          <div className="flex items-center gap-0.5 shrink-0">
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onRefresh} disabled={refreshing} title="Check price now" aria-label="Check price now">
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
            </Button>
            <Button size="sm" variant="ghost"
              className={cn("h-8 w-8 p-0", p.alertThreshold != null && "text-theme", hit && "text-green-400")}
              onClick={() => setAlertOpen((v) => !v)}
              title={p.alertThreshold != null ? `Alert at ${formatPrice(p.alertThreshold)}` : "Set a price alert"} aria-label="Price alert" aria-expanded={alertOpen}>
              {p.alertThreshold != null ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
            </Button>
            <Button size="sm" variant="ghost" className={cn("h-8 w-8 p-0", emailOn && "text-theme")}
              onClick={() => { setAlertOpen(true); onSaveAlert({ notifyEmail: !emailOn }); }}
              title={emailOn ? "Emailing you when this hits your target — click to turn off" : "Email me when this hits my target"}
              aria-label="Toggle email alert" aria-pressed={emailOn}>
              {emailOn ? <MailCheck className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
            </Button>
            <a href={p.url} target="_blank" rel="noopener noreferrer" title="Open product page" aria-label="Open product page">
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" tabIndex={-1}><ExternalLink className="w-3.5 h-3.5" /></Button>
            </a>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:text-destructive" onClick={onDelete} title="Stop tracking" aria-label="Stop tracking">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
            {history.length > 1 && (
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setOpen((v) => !v)} title="Price history" aria-label="Price history" aria-expanded={open}>
                <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
              </Button>
            )}
          </div>
        </div>

        {/* Alert editor */}
        {alertOpen && (
          <div className="mt-3 rounded-xl bg-secondary/40 border border-border/60 p-3.5 space-y-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Alert me at or below</p>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-32">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">$</span>
                  <input
                    type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && target.trim() && !isNaN(parseFloat(target))) saveTarget(parseFloat(target)); }}
                    className="w-full pl-6 pr-2 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring tabular-nums"
                  />
                </div>
                {[5, 10, 15].map((pct) => (
                  <button key={pct} onClick={() => quickTarget(pct)} disabled={p.currentPrice == null}
                    className="px-2 py-1 text-xs rounded-md border border-border bg-background hover:bg-accent disabled:opacity-40">
                    {pct}% off
                  </button>
                ))}
                <Button size="sm" className="h-8 bg-theme hover:brightness-90" disabled={saving || !target.trim() || isNaN(parseFloat(target))}
                  onClick={() => saveTarget(parseFloat(target))}>
                  Save
                </Button>
                {p.alertThreshold != null && (
                  <button className="text-xs text-muted-foreground hover:text-destructive" onClick={() => saveTarget(null)}>Remove</button>
                )}
              </div>
            </div>

            <div className="flex items-start justify-between gap-3 pt-3 border-t border-border/60">
              <div className="min-w-0">
                <p className="text-sm font-medium flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-theme" />Email me about this one</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {settings?.emailEnabled
                    ? settings.smtpConfigured
                      ? "You'll get an email when it reaches your target — once, not on every check."
                      : "Email isn't set up on the server yet — add SMTP details in Settings first."
                    : <>Email alerts are off. Turn them on in <Link href="/settings" className="text-theme hover:underline">Settings → Price Alerts</Link>.</>}
                </p>
              </div>
              <button
                role="switch" aria-checked={emailOn} aria-label="Email me about this product"
                onClick={() => onSaveAlert({ notifyEmail: !emailOn })}
                className={cn("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 mt-0.5",
                  emailOn ? "bg-theme" : "bg-secondary border border-border")}
              >
                <span className={cn("inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200", emailOn ? "translate-x-4" : "translate-x-0.5")} />
              </button>
            </div>
          </div>
        )}

        {/* Full price history */}
        {open && history.length > 1 && (
          <div className="mt-3 pt-3 border-t border-border/60">
            <p className="text-xs text-muted-foreground mb-2">{history.length} price points</p>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={history} margin={{ top: 4, right: 6, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} minTickGap={24} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickFormatter={(v) => `$${v}`} width={48} domain={["auto", "auto"]} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatPrice(v), "Price"]} />
                <Line type="monotone" dataKey="price" stroke="hsl(var(--theme))" strokeWidth={2} dot={{ r: 2.5, fill: "hsl(var(--theme))" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
