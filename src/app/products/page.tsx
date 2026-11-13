"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Bell, BellRing, Download, Mail, MailX, Package, PiggyBank, Plus, RefreshCw, Search,
  ShoppingCart, SlidersHorizontal, TrendingDown, AlertTriangle,
} from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ProductCard } from "@/components/products/ProductCard";
import { BulkAlertDialog } from "@/components/products/BulkAlertDialog";
import {
  AlertSettingsLite, TrackedProduct, isAlertHit, isDropped, isOutOfStock,
} from "@/components/products/types";

type Filter = "all" | "alerts" | "drops" | "stock" | "problems";
type Sort = "updated" | "drop" | "priceAsc" | "priceDesc" | "name" | "alerts";

const SORTS: { id: Sort; label: string }[] = [
  { id: "updated", label: "Recently updated" },
  { id: "alerts", label: "Alerts first" },
  { id: "drop", label: "Biggest drop" },
  { id: "priceAsc", label: "Price: low to high" },
  { id: "priceDesc", label: "Price: high to low" },
  { id: "name", label: "Name A–Z" },
];

export default function ProductsPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<TrackedProduct[]>([]);
  const [settings, setSettings] = useState<AlertSettingsLite | null>(null);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkApplying, setBulkApplying] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("updated");

  const load = useCallback(async () => {
    try {
      const d = await fetch("/api/products").then((r) => r.json());
      const list: TrackedProduct[] = Array.isArray(d) ? d : [];
      setProducts(list);
      return list;
    } catch {
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load, plus a quiet refresh of anything stale. The server also
  // re-checks in the background (Settings → Price Alerts), so this is just so
  // the page is current the moment you open it.
  useEffect(() => {
    (async () => {
      const [list, s] = await Promise.all([
        load(),
        fetch("/api/products/settings").then((r) => r.json()).catch(() => null),
      ]);
      if (s && !s.error) setSettings(s);
      const staleHours = Math.min(s?.intervalHours ?? 6, 6);
      const stale = list.filter((p) => !p.lastChecked || Date.now() - new Date(p.lastChecked).getTime() > staleHours * 3_600_000);
      let i = 0;
      await Promise.all(Array.from({ length: Math.min(3, stale.length) }, async () => {
        while (i < stale.length) {
          const p = stale[i++];
          try {
            const r = await fetch(`/api/products/${p.id}/refresh`, { method: "POST" });
            if (r.ok) { const u = await r.json(); setProducts((cur) => cur.map((x) => (x.id === p.id ? u : x))); }
          } catch { /* silent — the card shows its own error state */ }
        }
      }));
    })();
  }, [load]);

  const patchLocal = (u: TrackedProduct) => setProducts((cur) => cur.map((x) => (x.id === u.id ? u : x)));

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/products/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
      toast(data.added === 0
        ? { title: "Already up to date", description: "All mod links are already being tracked." }
        : { title: `Added ${data.added} product${data.added !== 1 ? "s" : ""} from your mods`, description: data.failed > 0 ? `${data.failed} couldn't be read.` : undefined });
    } catch {
      toast({ title: "Sync failed", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleRefreshAll = async () => {
    if (products.length === 0) return;
    setRefreshingAll(true);
    try {
      const res = await fetch("/api/products/refresh-all", { method: "POST" });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      if (Array.isArray(updated)) setProducts(updated);
      toast({ title: "Prices updated" });
    } catch {
      toast({ title: "Refresh failed", variant: "destructive" });
    } finally {
      setRefreshingAll(false);
    }
  };

  const handleRefresh = async (id: string) => {
    setRefreshingId(id);
    try {
      const res = await fetch(`/api/products/${id}/refresh`, { method: "POST" });
      if (!res.ok) throw new Error();
      const u: TrackedProduct = await res.json();
      patchLocal(u);
      toast(u.lastError ? { title: "Couldn't read the price", description: u.lastError, variant: "destructive" } : { title: "Price updated" });
    } catch {
      toast({ title: "Failed to refresh", variant: "destructive" });
    } finally {
      setRefreshingId(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: urlInput.trim() }),
      });
      const data = await res.json();
      if (res.status === 409) {
        toast({ title: "Already tracked", description: "This product is already in your tracker." });
      } else if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "");
      } else {
        setProducts((p) => [data, ...p]);
        setUrlInput(""); setAddOpen(false);
        toast(data.lastError
          ? { title: "Added, but the price couldn't be read", description: "Some shops block automated checks. We'll keep trying." }
          : { title: "Now tracking this product" });
      }
    } catch (err) {
      toast({ title: "Failed to add product", description: err instanceof Error && err.message ? err.message : "Try a direct product page URL.", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Stop tracking this product?")) return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (res.ok) { setProducts((p) => p.filter((x) => x.id !== id)); toast({ title: "Product removed" }); }
  };

  const saveAlert = async (id: string, patch: { alertThreshold?: number | null; notifyEmail?: boolean }) => {
    const res = await fetch(`/api/products/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    if (!res.ok) { toast({ title: "Couldn't save", variant: "destructive" }); return; }
    patchLocal(await res.json());
    if (patch.alertThreshold !== undefined) toast({ title: patch.alertThreshold == null ? "Alert removed" : "Alert saved" });
  };

  const applyBulk = async (body: { mode: string; value?: number; notifyEmail?: boolean }) => {
    setBulkApplying(true);
    try {
      const res = await fetch("/api/products/bulk-alert", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      if (Array.isArray(updated)) setProducts(updated);
      setBulkOpen(false);
      toast({ title: body.mode === "clear" ? "Alerts cleared" : "Alerts set" });
    } catch {
      toast({ title: "Couldn't apply alerts", variant: "destructive" });
    } finally {
      setBulkApplying(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const counts = useMemo(() => ({
    alerts: products.filter(isAlertHit).length,
    drops: products.filter(isDropped).length,
    stock: products.filter(isOutOfStock).length,
    problems: products.filter((p) => !!p.lastError).length,
  }), [products]);

  const savings = useMemo(
    () => products.reduce((s, p) => s + (p.highestPrice != null && p.currentPrice != null && p.currentPrice < p.highestPrice ? p.highestPrice - p.currentPrice : 0), 0),
    [products]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = products.filter((p) => {
      if (filter === "alerts" && !isAlertHit(p)) return false;
      if (filter === "drops" && !isDropped(p)) return false;
      if (filter === "stock" && !isOutOfStock(p)) return false;
      if (filter === "problems" && !p.lastError) return false;
      return !q || [p.title, p.vendor, p.brand, p.sku].some((f) => f?.toLowerCase().includes(q));
    });
    const dropPct = (p: TrackedProduct) =>
      p.previousPrice && p.currentPrice != null ? (p.previousPrice - p.currentPrice) / p.previousPrice : 0;
    const by: Record<Sort, (a: TrackedProduct, b: TrackedProduct) => number> = {
      updated: (a, b) => new Date(b.lastChecked ?? 0).getTime() - new Date(a.lastChecked ?? 0).getTime(),
      alerts: (a, b) => Number(isAlertHit(b)) - Number(isAlertHit(a)) || dropPct(b) - dropPct(a),
      drop: (a, b) => dropPct(b) - dropPct(a),
      priceAsc: (a, b) => (a.currentPrice ?? Infinity) - (b.currentPrice ?? Infinity),
      priceDesc: (a, b) => (b.currentPrice ?? -Infinity) - (a.currentPrice ?? -Infinity),
      name: (a, b) => a.title.localeCompare(b.title),
    };
    return [...list].sort(by[sort]);
  }, [products, search, filter, sort]);

  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="h-24 rounded-xl bg-secondary/40 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-secondary/40 animate-pulse" />)}</div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">{[0, 1].map((i) => <div key={i} className="h-56 rounded-xl bg-secondary/40 animate-pulse" />)}</div>
      </div>
    );
  }

  const emailLive = !!settings?.emailEnabled && !!settings.smtpConfigured;
  const stats = [
    { label: "Tracking", value: String(products.length), sub: counts.problems ? `${counts.problems} need attention` : "all up to date", icon: Package, color: "text-blue-400 bg-blue-500/10", stripe: "bg-blue-400" },
    { label: "Targets hit", value: String(counts.alerts), sub: counts.alerts ? "at or below your price" : "none yet", icon: BellRing, color: counts.alerts ? "text-green-400 bg-green-500/10" : "text-muted-foreground bg-secondary", stripe: counts.alerts ? "bg-green-400" : "bg-border" },
    { label: "Below peak", value: formatPrice(savings), sub: "total vs. highest prices", icon: PiggyBank, color: "text-theme bg-theme/10", stripe: "bg-theme" },
  ];

  return (
    <div className="animate-fade-in">
      {/* Hero banner */}
      <div className="-mx-6 -mt-8 mb-8 px-6 pt-8 pb-6 border-b border-border/60 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-theme/5 pointer-events-none" />
        <div className="absolute top-0 right-0 w-72 h-36 bg-theme/8 rounded-full blur-3xl -translate-y-8 translate-x-8 pointer-events-none" />
        <div className="relative flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-medium text-muted-foreground/60 tracking-wider uppercase mb-1">Price Monitoring</p>
            <h1 className="text-3xl font-bold tracking-tight">Product Tracker</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {settings?.autoCheck
                ? `Prices are re-checked automatically every ${settings.intervalHours >= 24 ? `${Math.round(settings.intervalHours / 24)} day${settings.intervalHours >= 48 ? "s" : ""}` : `${settings.intervalHours} hour${settings.intervalHours === 1 ? "" : "s"}`}`
                : "Automatic checking is off — prices update when you refresh"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" className="gap-2" onClick={handleSync} disabled={syncing}>
              {syncing ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {syncing ? "Syncing…" : "Sync from Mods"}
            </Button>
            {products.length > 0 && (
              <>
                <Button variant="outline" className="gap-2" onClick={() => setBulkOpen(true)}>
                  <SlidersHorizontal className="w-3.5 h-3.5" />Bulk alerts
                </Button>
                <Button variant="outline" className="gap-2" onClick={handleRefreshAll} disabled={refreshingAll}>
                  <RefreshCw className={cn("w-3.5 h-3.5", refreshingAll && "animate-spin")} />
                  {refreshingAll ? "Refreshing…" : "Refresh all"}
                </Button>
              </>
            )}
            <Button onClick={() => setAddOpen(true)} className="bg-theme hover:brightness-90 gap-2">
              <Plus className="w-4 h-4" />Track product
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {products.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {stats.map(({ label, value, sub, icon: Icon, color, stripe }) => (
              <Card key={label} className="relative overflow-hidden hover:-translate-y-px hover:shadow-lg hover:shadow-black/25 transition-all duration-200">
                <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${stripe}`} />
                <CardContent className="p-4 sm:p-5 flex items-center gap-4">
                  <div className={`hidden sm:flex w-11 h-11 rounded-xl items-center justify-center flex-shrink-0 ${color}`}><Icon className="w-5 h-5" /></div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">{label}</p>
                    <p className="text-xl sm:text-2xl font-bold tabular-nums leading-tight mt-0.5 truncate">{value}</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{sub}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
            {/* Email status — links to where it's configured */}
            <Link href="/settings" className="block">
              <Card className="relative overflow-hidden h-full hover:-translate-y-px hover:shadow-lg hover:shadow-black/25 hover:border-theme/30 transition-all duration-200">
                <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${emailLive ? "bg-green-400" : "bg-border"}`} />
                <CardContent className="p-4 sm:p-5 flex items-center gap-4">
                  <div className={cn("hidden sm:flex w-11 h-11 rounded-xl items-center justify-center flex-shrink-0", emailLive ? "text-green-400 bg-green-500/10" : "text-muted-foreground bg-secondary")}>
                    {emailLive ? <Mail className="w-5 h-5" /> : <MailX className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Email alerts</p>
                    <p className="text-2xl font-bold leading-tight mt-0.5">{emailLive ? "On" : "Off"}</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">
                      {emailLive ? `${products.filter((p) => p.notifyEmail).length} product${products.filter((p) => p.notifyEmail).length === 1 ? "" : "s"} emailing you` : settings?.emailEnabled ? "SMTP not set up" : "Set up in Settings"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        )}

        {products.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center rounded-2xl border border-dashed border-border/60 bg-secondary/10">
            <div className="w-16 h-16 rounded-2xl bg-theme/10 flex items-center justify-center mb-5"><ShoppingCart className="w-8 h-8 text-theme" /></div>
            <h3 className="text-xl font-bold mb-2">No tracked products yet</h3>
            <p className="text-muted-foreground text-sm max-w-sm mb-6 leading-relaxed">
              Import every product link from your mods, or paste a product page. We&apos;ll watch the price and can email you when it drops.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleSync} disabled={syncing} className="gap-2"><Download className="w-4 h-4" />{syncing ? "Syncing…" : "Sync from Mods"}</Button>
              <Button onClick={() => setAddOpen(true)} className="bg-theme hover:brightness-90 gap-2"><Plus className="w-4 h-4" />Track a product</Button>
            </div>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search products…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {([
                  ["all", "All", products.length],
                  ["alerts", "Targets hit", counts.alerts],
                  ["drops", "Price dropped", counts.drops],
                  ["stock", "Out of stock", counts.stock],
                  ["problems", "Needs attention", counts.problems],
                ] as [Filter, string, number][])
                  .filter(([id, , n]) => id === "all" || n > 0 || filter === id)
                  .map(([id, label, n]) => (
                    <button key={id} onClick={() => setFilter(id)}
                      className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-all",
                        filter === id ? "border-theme bg-theme/10 text-theme" : "border-border bg-secondary text-muted-foreground hover:text-foreground")}>
                      {id === "problems" && <AlertTriangle className="w-3 h-3" />}
                      {id === "drops" && <TrendingDown className="w-3 h-3" />}
                      {id === "alerts" && <Bell className="w-3 h-3" />}
                      {label}
                      <span className="tabular-nums opacity-70">{n}</span>
                    </button>
                  ))}
              </div>
              <div className="sm:ml-auto w-full sm:w-52">
                <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
                  <SelectTrigger aria-label="Sort products"><SelectValue /></SelectTrigger>
                  <SelectContent>{SORTS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {visible.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground rounded-2xl border border-dashed border-border/60">
                Nothing matches.{" "}
                <button className="text-theme hover:underline" onClick={() => { setSearch(""); setFilter("all"); }}>Clear filters</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                {visible.map((p) => (
                  <ProductCard
                    key={p.id} product={p} settings={settings}
                    refreshing={refreshingId === p.id || refreshingAll}
                    onRefresh={() => handleRefresh(p.id)}
                    onDelete={() => handleDelete(p.id)}
                    onSaveAlert={(patch) => saveAlert(p.id, patch)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <BulkAlertDialog open={bulkOpen} onOpenChange={setBulkOpen} count={products.length} applying={bulkApplying} onApply={applyBulk} />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Track a product</DialogTitle></DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <Label>Product URL</Label>
              <Input placeholder="https://www.example.com/products/…" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} required type="url" autoFocus />
              <p className="text-xs text-muted-foreground mt-1.5">
                Paste a direct product page. Tip: <strong>Sync from Mods</strong> imports every link you&apos;ve saved on your mods.
              </p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Works best with shops that publish structured product data</p>
              <p>ECS Tuning · FCP Euro · 034Motorsport · APR · Unitronic · CTS Turbo · UROTuning · BMP Tuning · AutoZone · RockAuto · Amazon · Tire Rack. Some shops block automated checks.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={adding} className="bg-theme hover:brightness-90">
                {adding ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Fetching…</> : "Track product"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
