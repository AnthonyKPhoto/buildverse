"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, Car, Wrench, ClipboardList, ShoppingCart, ArrowRight } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

interface SearchResults {
  vehicles: { id: string; name?: string | null; year: number; make: string; model: string; trim?: string | null }[];
  modifications: { id: string; name: string; status: string; category: string; vehicleId: string; vehicle: { name?: string | null; year: number; make: string; model: string } }[];
  maintenance: { id: string; service: string; vehicleId: string; vehicle: { name?: string | null; year: number; make: string; model: string } }[];
  products: { id: string; title: string; currentPrice?: number | null; vendor?: string | null; brand?: string | null }[];
}

interface Props { open: boolean; onOpenChange: (open: boolean) => void; }

function vLabel(v: { name?: string | null; year: number; make: string; model: string }) {
  return v.name || `${v.year} ${v.make} ${v.model}`;
}

function Section({ title, icon: Icon, children }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 px-4 py-1.5">
        <Icon className="w-3 h-3 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</span>
      </div>
      {children}
    </div>
  );
}

function ResultItem({ href, primary, secondary, onSelect }: {
  href: string; primary: string; secondary?: string; onSelect: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onSelect}
      className="flex items-center justify-between px-4 py-2.5 hover:bg-secondary/50 transition-colors group"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{primary}</p>
        {secondary && <p className="text-xs text-muted-foreground truncate">{secondary}</p>}
      </div>
      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
    </Link>
  );
}

export function GlobalSearch({ open, onOpenChange }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!open) { setQ(""); setResults(null); }
  }, [open]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data) => { setResults(data); setLoading(false); })
        .catch(() => setLoading(false));
    }, 280);
  }, [q]);

  const total = results
    ? results.vehicles.length + results.modifications.length + results.maintenance.length + results.products.length
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className={`w-4 h-4 shrink-0 ${loading ? "text-theme animate-pulse" : "text-muted-foreground"}`} />
          <Input
            className="border-0 p-0 h-auto text-sm bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
            placeholder="Search mods, vehicles, products, service…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <kbd className="hidden sm:inline text-xs text-muted-foreground/40 border border-border rounded px-1.5 py-0.5 shrink-0">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {q.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Start typing to search everything…
            </p>
          )}
          {q.length === 1 && (
            <p className="py-10 text-center text-sm text-muted-foreground">Type at least 2 characters</p>
          )}
          {results && total === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No results for &quot;{q}&quot;</p>
          )}

          {results && total > 0 && (
            <div className="py-2">
              {results.vehicles.length > 0 && (
                <Section title="Vehicles" icon={Car}>
                  {results.vehicles.map((v) => (
                    <ResultItem
                      key={v.id}
                      href={`/garage/${v.id}`}
                      primary={v.name || `${v.year} ${v.make} ${v.model}`}
                      secondary={v.name ? `${v.year} ${v.make} ${v.model}${v.trim ? ` · ${v.trim}` : ""}` : undefined}
                      onSelect={() => onOpenChange(false)}
                    />
                  ))}
                </Section>
              )}
              {results.modifications.length > 0 && (
                <Section title="Modifications" icon={Wrench}>
                  {results.modifications.map((m) => (
                    <ResultItem
                      key={m.id}
                      href={`/garage/${m.vehicleId}`}
                      primary={m.name}
                      secondary={`${vLabel(m.vehicle)} · ${m.category}`}
                      onSelect={() => onOpenChange(false)}
                    />
                  ))}
                </Section>
              )}
              {results.maintenance.length > 0 && (
                <Section title="Service Logs" icon={ClipboardList}>
                  {results.maintenance.map((l) => (
                    <ResultItem
                      key={l.id}
                      href={`/garage/${l.vehicleId}`}
                      primary={l.service}
                      secondary={vLabel(l.vehicle)}
                      onSelect={() => onOpenChange(false)}
                    />
                  ))}
                </Section>
              )}
              {results.products.length > 0 && (
                <Section title="Products" icon={ShoppingCart}>
                  {results.products.map((p) => (
                    <ResultItem
                      key={p.id}
                      href="/products"
                      primary={p.title}
                      secondary={[p.vendor ?? p.brand, p.currentPrice != null ? formatCurrency(p.currentPrice) : null].filter(Boolean).join(" · ")}
                      onSelect={() => onOpenChange(false)}
                    />
                  ))}
                </Section>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
