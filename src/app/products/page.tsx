"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  ShoppingCart, Plus, RefreshCw, Trash2, ExternalLink,
  Package, Clock, Search, Download, CheckCircle2, Bell, BellOff,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface PriceHistory { id: string; price: number; createdAt: string; }

interface TrackedProduct {
  id: string; url: string; title: string; brand?: string; imageUrl?: string;
  description?: string; currentPrice?: number; lowestPrice?: number;
  highestPrice?: number; alertThreshold?: number | null; vendor?: string;
  availability?: string; sku?: string; lastChecked?: string; createdAt: string;
  priceHistory: PriceHistory[];
}

const STALE_HOURS = 6; // auto-refresh if not checked within this many hours

function isStale(lastChecked?: string): boolean {
  if (!lastChecked) return true;
  const diff = Date.now() - new Date(lastChecked).getTime();
  return diff > STALE_HOURS * 60 * 60 * 1000;
}

export default function ProductsPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<TrackedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [alertFilter, setAlertFilter] = useState(false);
  const [thresholdEditing, setThresholdEditing] = useState<string | null>(null);
  const [thresholdInput, setThresholdInput] = useState("");

  // ── Load ─────────────────────────────────────────────────────────────────────
  const load = useCallback(() =>
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => { setProducts(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false)),
  []);

  // ── Auto-refresh stale products silently on page load ─────────────────────
  useEffect(() => {
    load().then(async () => {
      setProducts((prev) => {
        const stale = prev.filter((p) => isStale(p.lastChecked));
        if (stale.length === 0) return prev;

        // Fire-and-forget refresh for each stale product
        Promise.allSettled(
          stale.map((p) =>
            fetch(`/api/products/${p.id}/refresh`, { method: "POST" })
              .then((r) => r.json())
              .then((updated) => {
                setProducts((curr) => curr.map((x) => (x.id === p.id ? updated : x)));
              })
              .catch(() => {})
          )
        );

        return prev; // return unchanged — updates will come in via setProducts above
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync from mods ───────────────────────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/products/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
      if (data.added === 0) {
        toast({ title: "Already up to date", description: "All mod links are already being tracked." });
      } else {
        toast({
          title: `Synced ${data.added} product${data.added !== 1 ? "s" : ""} from mods`,
          description: data.failed > 0 ? `${data.failed} couldn't be scraped.` : undefined,
        });
      }
    } catch {
      toast({ title: "Sync failed", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  // ── Refresh all ──────────────────────────────────────────────────────────────
  const handleRefreshAll = async () => {
    if (products.length === 0) return;
    setRefreshingAll(true);
    try {
      const res = await fetch("/api/products/refresh-all", { method: "POST" });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setProducts(Array.isArray(updated) ? updated : products);
      toast({ title: "All products refreshed!" });
    } catch {
      toast({ title: "Refresh failed", variant: "destructive" });
    } finally {
      setRefreshingAll(false);
    }
  };

  // ── Single refresh ───────────────────────────────────────────────────────────
  const handleRefresh = async (id: string) => {
    setRefreshingId(id);
    try {
      const res = await fetch(`/api/products/${id}/refresh`, { method: "POST" });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setProducts((p) => p.map((x) => (x.id === id ? updated : x)));
      toast({ title: "Price refreshed!" });
    } catch {
      toast({ title: "Failed to refresh", variant: "destructive" });
    } finally {
      setRefreshingId(null);
    }
  };

  // ── Add ──────────────────────────────────────────────────────────────────────
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          toast({ title: "Already tracked", description: "This product is already in your tracker." });
        } else {
          throw new Error(data.error);
        }
      } else {
        setProducts((p) => [data, ...p]);
        setUrlInput("");
        setAddOpen(false);
        toast({ title: "Product added to tracker!" });
      }
    } catch {
      toast({ title: "Failed to add product", description: "Couldn't scrape the URL. Try a direct product page.", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm("Stop tracking this product?")) return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (res.ok) {
      setProducts((p) => p.filter((x) => x.id !== id));
      toast({ title: "Product removed" });
    }
  };

  const saveThreshold = async (id: string, value: string) => {
    const threshold = value.trim() ? parseFloat(value.replace("$", "")) : null;
    const res = await fetch(`/api/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertThreshold: threshold }),
    });
    if (res.ok) {
      const updated = await res.json();
      setProducts((p) => p.map((x) => x.id === id ? { ...x, alertThreshold: updated.alertThreshold } : x));
    }
    setThresholdEditing(null);
  };

  const alertCount = products.filter((p) =>
    p.alertThreshold != null && p.currentPrice != null && p.currentPrice <= p.alertThreshold
  ).length;

  const filtered = products.filter((p) => {
    if (alertFilter) {
      if (p.alertThreshold == null || p.currentPrice == null || p.currentPrice > p.alertThreshold) return false;
    }
    return !search || p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.vendor?.toLowerCase().includes(search.toLowerCase()) ||
      p.brand?.toLowerCase().includes(search.toLowerCase());
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="w-5 h-5 border-2 border-theme border-t-transparent rounded-full animate-spin" />
          Loading products…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Product Tracker</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tracks prices automatically — updates every {STALE_HOURS} hours when you visit this page
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Sync from mods */}
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            {syncing ? "Syncing…" : "Sync from Mods"}
          </Button>

          {/* Refresh all */}
          {products.length > 0 && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleRefreshAll}
              disabled={refreshingAll}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingAll ? "animate-spin" : ""}`} />
              {refreshingAll ? "Refreshing…" : "Refresh All"}
            </Button>
          )}

          {/* Alert filter */}
          {alertCount > 0 && (
            <Button
              variant={alertFilter ? "default" : "outline"}
              className={`gap-2 ${alertFilter ? "bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30" : ""}`}
              onClick={() => setAlertFilter((f) => !f)}
            >
              <Bell className="w-3.5 h-3.5" />
              {alertCount} Alert{alertCount !== 1 ? "s" : ""}
            </Button>
          )}

          {/* Add manual */}
          <Button onClick={() => setAddOpen(true)} className="bg-theme hover:brightness-90 gap-2">
            <Plus className="w-4 h-4" />
            Track Product
          </Button>
        </div>
      </div>

      {/* Search */}
      {products.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search products…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* Empty state */}
      {products.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <ShoppingCart className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No tracked products</h3>
            <p className="text-muted-foreground text-sm max-w-xs mb-6">
              Click <strong>Sync from Mods</strong> to automatically import all product links from your mods, or paste a URL manually.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSync} disabled={syncing} className="gap-2">
                <Download className="w-4 h-4" />
                {syncing ? "Syncing…" : "Sync from Mods"}
              </Button>
              <Button onClick={() => setAddOpen(true)} className="bg-theme hover:brightness-90">
                <Plus className="w-4 h-4 mr-2" />
                Add Manually
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((product) => {
            const isExpanded   = expandedId === product.id;
            const isAtLowest   = product.currentPrice != null && product.lowestPrice != null && product.currentPrice <= product.lowestPrice;
            const alertTripped = product.alertThreshold != null && product.currentPrice != null && product.currentPrice <= product.alertThreshold;
            const stale = isStale(product.lastChecked);

            const chartData = [...product.priceHistory]
              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
              .map((h) => ({ date: new Date(h.createdAt).toLocaleDateString(), price: h.price }));

            return (
              <Card key={product.id} className="overflow-hidden hover:border-border/60 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Image */}
                    <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-secondary">
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.imageUrl} alt={product.title} className="object-cover w-full h-full" onError={(e) => (e.currentTarget.style.display = "none")} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-8 h-8 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm leading-tight line-clamp-2">{product.title}</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {product.vendor && (
                              <Badge variant="secondary" className="text-xs">{product.vendor}</Badge>
                            )}
                            {product.brand && (
                              <Badge variant="outline" className="text-xs">{product.brand}</Badge>
                            )}
                            {product.availability && (
                              <Badge className={`text-xs ${product.availability.toLowerCase().includes("stock") ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}>
                                {product.availability}
                              </Badge>
                            )}
                            {isAtLowest && (
                              <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30 gap-1">
                                <CheckCircle2 className="w-3 h-3" />Lowest Price!
                              </Badge>
                            )}
                            {alertTripped && (
                              <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30 gap-1">
                                <Bell className="w-3 h-3" />Price Alert!
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Price */}
                        <div className="text-right flex-shrink-0">
                          <p className="text-2xl font-bold">
                            {product.currentPrice != null ? formatCurrency(product.currentPrice) : "—"}
                          </p>
                          {product.lowestPrice != null && product.highestPrice != null && product.lowestPrice !== product.highestPrice && (
                            <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                              <p className="text-green-400">Low: {formatCurrency(product.lowestPrice)}</p>
                              <p className="text-red-400">High: {formatCurrency(product.highestPrice)}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Meta */}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span className={stale ? "text-yellow-500" : ""}>
                          {product.lastChecked ? `Checked ${formatDate(product.lastChecked)}` : "Never checked"}
                          {stale && refreshingId !== product.id && " · updating…"}
                        </span>
                        {product.sku && <span>SKU: {product.sku}</span>}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <a href={product.url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Open product page">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </a>
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0"
                        onClick={() => handleRefresh(product.id)}
                        disabled={refreshingId === product.id}
                        title="Refresh price now"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshingId === product.id ? "animate-spin" : ""}`} />
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        className={`h-7 w-7 p-0 ${alertTripped ? "text-green-400" : product.alertThreshold != null ? "text-theme" : ""}`}
                        title={product.alertThreshold != null ? `Alert at ${formatCurrency(product.alertThreshold)} — click to edit` : "Set price alert"}
                        onClick={() => { setThresholdEditing(product.id); setThresholdInput(product.alertThreshold?.toString() ?? ""); }}
                      >
                        {product.alertThreshold != null ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:text-destructive" onClick={() => handleDelete(product.id)} title="Stop tracking">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Alert threshold editor */}
                  {thresholdEditing === product.id && (
                    <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                      <Bell className="w-3.5 h-3.5 text-theme shrink-0" />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">Alert when price drops to</span>
                      <input
                        className="w-24 px-2 py-1 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        placeholder="$0.00"
                        value={thresholdInput}
                        onChange={(e) => setThresholdInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveThreshold(product.id, thresholdInput); if (e.key === "Escape") setThresholdEditing(null); }}
                        autoFocus
                      />
                      <button className="text-xs text-theme hover:underline" onClick={() => saveThreshold(product.id, thresholdInput)}>Save</button>
                      {product.alertThreshold != null && (
                        <button className="text-xs text-muted-foreground hover:text-destructive" onClick={() => saveThreshold(product.id, "")}>Remove</button>
                      )}
                      <button className="text-xs text-muted-foreground" onClick={() => setThresholdEditing(null)}>Cancel</button>
                    </div>
                  )}

                  {/* Price history chart */}
                  {chartData.length > 1 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <Button
                        variant="ghost" size="sm"
                        className="text-xs text-muted-foreground h-6 px-0"
                        onClick={() => setExpandedId(isExpanded ? null : product.id)}
                      >
                        {isExpanded ? "Hide price history" : `Show price history (${chartData.length} data points)`}
                      </Button>
                      {isExpanded && (
                        <div className="mt-3">
                          <ResponsiveContainer width="100%" height={160}>
                            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
                              <XAxis dataKey="date" tick={{ fill: "hsl(215 20% 55%)", fontSize: 10 }} />
                              <YAxis tick={{ fill: "hsl(215 20% 55%)", fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                              <Tooltip
                                contentStyle={{ backgroundColor: "hsl(222 47% 9%)", border: "1px solid hsl(217 33% 17%)", borderRadius: "8px", fontSize: 12 }}
                                formatter={(v: number) => [formatCurrency(v), "Price"]}
                              />
                              <Line type="monotone" dataKey="price" stroke="hsl(var(--theme))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--theme))" }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Product Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Track a Product</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <Label>Product URL</Label>
              <Input
                placeholder="https://www.ecstuning.com/b-ecs-parts/…"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                required
                type="url"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Paste any direct product page URL. Tip: use <strong>Sync from Mods</strong> to import all your mod links automatically.
              </p>
            </div>

            <div className="bg-secondary/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Supported vendors include:</p>
              <p>ECS Tuning · FCP Euro · 034Motorsport · APR · Unitronic · CTS Turbo</p>
              <p>UROTuning · BMP Tuning · AutoZone · RockAuto · Amazon · Tire Rack</p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={adding} className="bg-theme hover:brightness-90">
                {adding ? (
                  <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Fetching…</>
                ) : "Track Product"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
