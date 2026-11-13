"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Car } from "lucide-react";
import { cn } from "@/lib/utils";

interface Row { id: string; name: string; links: number; untracked: number; done: number }

/** "Sync from Mods": pick which cars' product links to start tracking. */
export function SyncDialog({
  open, onOpenChange, syncing, onSync,
}: { open: boolean; onOpenChange: (o: boolean) => void; syncing: boolean; onSync: (vehicleIds: string[]) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setRows(null);
    fetch("/api/products/sync").then((r) => r.json()).then((d: Row[]) => {
      const list = Array.isArray(d) ? d : [];
      setRows(list);
      setPicked(new Set(list.filter((r) => r.untracked > 0).map((r) => r.id)));
    }).catch(() => setRows([]));
  }, [open]);

  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const total = (rows ?? []).filter((r) => picked.has(r.id)).reduce((s, r) => s + r.untracked, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sync from Mods</DialogTitle>
          <DialogDescription>Choose the cars whose mod links you want price-tracked. Mods already purchased, installed or removed are skipped.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {rows === null && <div className="h-16 rounded-lg bg-secondary/40 animate-pulse" />}
          {rows?.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No vehicles found.</p>}
          {rows?.map((r) => (
            <label key={r.id} className={cn("flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
              picked.has(r.id) ? "border-theme bg-theme/5" : "border-border bg-secondary/30 hover:bg-secondary/60")}>
              <input type="checkbox" className="w-4 h-4 accent-[hsl(var(--theme))]" checked={picked.has(r.id)} onChange={() => toggle(r.id)} />
              <Car className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium truncate">{r.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {r.untracked} new link{r.untracked === 1 ? "" : "s"} · {r.links - r.untracked} already tracked{r.done ? ` · ${r.done} skipped (bought)` : ""}
                </span>
              </span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-theme hover:brightness-90" disabled={syncing || picked.size === 0} onClick={() => onSync(Array.from(picked))}>
            {syncing ? "Syncing…" : total > 0 ? `Track ${total} link${total === 1 ? "" : "s"}` : "Sync selected"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
