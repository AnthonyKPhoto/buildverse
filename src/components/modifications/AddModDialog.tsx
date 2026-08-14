"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MOD_CATEGORIES, INSTALL_DIFFICULTIES } from "@/lib/utils";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { AutocompleteInput } from "@/components/ui/AutocompleteInput";
import { X, Link2 } from "lucide-react";

interface Suggestions { brands: string[]; vendors: string[]; names: string[]; }
interface DepMod { id: string; name: string; category: string; status: string; }

interface Modification {
  id: string; vehicleId: string; name: string; category: string; vendor?: string; brand?: string;
  price?: number | null; actualPrice?: number | null; notes?: string; priority: string;
  status: string; link?: string; imageUrl?: string; difficulty?: string; installDate?: string;
  installMileage?: number | null; laborCost?: number | null; diyInstall: boolean;
  partNumber?: string; orderNumber?: string;
}

interface AddModDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
  onSaved: (mod: Modification) => void;
  editMod?: Modification | null;
}

const STATUSES = ["PLANNED", "RESEARCHING", "ORDERED", "PURCHASED", "INSTALLED", "REMOVED"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const BLANK_FORM = {
  name: "", category: "", brand: "", vendor: "", price: "", actualPrice: "",
  status: "PLANNED", priority: "MEDIUM", difficulty: "UNKNOWN",
  link: "", imageUrl: "", notes: "", partNumber: "", orderNumber: "",
  installDate: "", installMileage: "", laborCost: "", diyInstall: false,
};

function formFromMod(m?: Modification | null) {
  if (!m) return BLANK_FORM;
  return {
    name: m.name ?? "",
    category: m.category ?? "",
    brand: m.brand ?? "",
    vendor: m.vendor ?? "",
    price: m.price?.toString() ?? "",
    actualPrice: m.actualPrice?.toString() ?? "",
    status: m.status ?? "PLANNED",
    priority: m.priority ?? "MEDIUM",
    difficulty: m.difficulty ?? "UNKNOWN",
    link: m.link ?? "",
    imageUrl: m.imageUrl ?? "",
    notes: m.notes ?? "",
    partNumber: m.partNumber ?? "",
    orderNumber: m.orderNumber ?? "",
    installDate: m.installDate ? m.installDate.slice(0, 10) : "",
    installMileage: m.installMileage?.toString() ?? "",
    laborCost: m.laborCost?.toString() ?? "",
    diyInstall: m.diyInstall ?? false,
  };
}

export function AddModDialog({ open, onOpenChange, vehicleId, onSaved, editMod }: AddModDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(formFromMod(editMod));
  const [suggestions, setSuggestions] = useState<Suggestions>({ brands: [], vendors: [], names: [] });
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // Dependencies state (edit mode only)
  const [deps, setDeps] = useState<DepMod[]>([]);
  const [allVehicleMods, setAllVehicleMods] = useState<DepMod[]>([]);
  const [depSearch, setDepSearch] = useState("");
  const [depOpen, setDepOpen] = useState(false);

  // Load suggestions once on mount
  useEffect(() => {
    fetch("/api/suggestions")
      .then((r) => r.json())
      .then((d) => { if (d.brands) setSuggestions(d); })
      .catch(() => {});
  }, []);

  // Reset form + deps every time the dialog opens
  useEffect(() => {
    if (open) {
      setForm(formFromMod(editMod));
      setDepSearch("");
      setDepOpen(false);
      if (editMod) {
        // Load existing dependencies for this mod
        fetch(`/api/modifications/${editMod.id}/dependencies`)
          .then((r) => r.json())
          .then((d) => setDeps(Array.isArray(d) ? d : []))
          .catch(() => {});
        // Load all other mods on this vehicle for the picker
        fetch(`/api/vehicles/${vehicleId}/modifications`)
          .then((r) => r.json())
          .then((d) => setAllVehicleMods(Array.isArray(d) ? d.filter((m: DepMod) => m.id !== editMod.id) : []))
          .catch(() => {});
      } else {
        setDeps([]);
        setAllVehicleMods([]);
      }
    }
  }, [open, editMod, vehicleId]);

  // Auto-grow notes textarea
  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  const addDep = async (dep: DepMod) => {
    if (!editMod || deps.some((d) => d.id === dep.id)) return;
    await fetch(`/api/modifications/${editMod.id}/dependencies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dependsOnId: dep.id }),
    });
    setDeps((prev) => [...prev, dep]);
    setDepSearch("");
    setDepOpen(false);
  };

  const removeDep = async (depId: string) => {
    if (!editMod) return;
    await fetch(`/api/modifications/${editMod.id}/dependencies`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dependsOnId: depId }),
    });
    setDeps((prev) => prev.filter((d) => d.id !== depId));
  };

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.category) {
      toast({ title: "Name and category are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        category: form.category,
        brand: form.brand || undefined,
        vendor: form.vendor || undefined,
        price: form.price ? parseFloat(form.price) : undefined,
        actualPrice: form.actualPrice ? parseFloat(form.actualPrice) : undefined,
        status: form.status,
        priority: form.priority,
        difficulty: (form.difficulty && form.difficulty !== "UNKNOWN") ? form.difficulty : undefined,
        link: form.link || undefined,
        imageUrl: form.imageUrl || undefined,
        notes: form.notes || undefined,
        partNumber: form.partNumber || undefined,
        orderNumber: form.orderNumber || undefined,
        installDate: form.installDate || undefined,
        installMileage: form.installMileage ? parseInt(form.installMileage) : undefined,
        laborCost: form.laborCost ? parseFloat(form.laborCost) : undefined,
        diyInstall: form.diyInstall,
      };

      const url = editMod ? `/api/modifications/${editMod.id}` : `/api/vehicles/${vehicleId}/modifications`;
      const method = editMod ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      const mod = await res.json();

      // Auto-track product link if enabled
      if (form.link) {
        const autoTrack = localStorage.getItem("bv_autoTrackProducts");
        const shouldTrack = autoTrack === null ? true : autoTrack === "true";
        if (shouldTrack) {
          fetch("/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: form.link }),
          }).catch(() => {}); // silent — don't block mod save
        }
      }

      onSaved(mod);
      onOpenChange(false);
      toast({ title: editMod ? "Modification updated" : "Modification added!" });
    } catch {
      toast({ title: "Failed to save modification", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editMod ? "Edit Modification" : "Add Modification"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name / Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name *</Label>
              <AutocompleteInput
                placeholder="BC Racing BR Coilovers…"
                value={form.name}
                onChange={(v) => set("name", v)}
                suggestions={suggestions.names}
              />
            </div>
            <div>
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {MOD_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Brand / Vendor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Brand</Label>
              <AutocompleteInput
                placeholder="BC Racing, APR, 034…"
                value={form.brand}
                onChange={(v) => set("brand", v)}
                suggestions={suggestions.brands}
              />
            </div>
            <div>
              <Label>Vendor</Label>
              <AutocompleteInput
                placeholder="ECS Tuning, FCP Euro…"
                value={form.vendor}
                onChange={(v) => set("vendor", v)}
                suggestions={suggestions.vendors}
              />
            </div>
          </div>

          {/* Status / Priority / Difficulty */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Install Difficulty</Label>
              <Select value={form.difficulty} onValueChange={(v) => set("difficulty", v)}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNKNOWN">Unknown</SelectItem>
                  {INSTALL_DIFFICULTIES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Price / Actual Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Estimated Price ($)</Label>
              <Input type="number" min="0" step="0.01" placeholder="1200.00" value={form.price} onChange={(e) => set("price", e.target.value)} />
            </div>
            <div>
              <Label>Actual Price Paid ($)</Label>
              <Input type="number" min="0" step="0.01" placeholder="1149.99" value={form.actualPrice} onChange={(e) => set("actualPrice", e.target.value)} />
            </div>
          </div>

          {/* Link */}
          <div>
            <Label>Product Link</Label>
            <Input placeholder="https://ecstuning.com/…" value={form.link} onChange={(e) => set("link", e.target.value)} />
          </div>

          {/* Image upload */}
          <ImageUpload
            label="Mod Photo"
            value={form.imageUrl}
            onChange={(v) => set("imageUrl", v)}
          />

          {/* Part# / Order# */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Part Number</Label>
              <Input placeholder="ES#1234567" value={form.partNumber} onChange={(e) => set("partNumber", e.target.value)} />
            </div>
            <div>
              <Label>Order Number</Label>
              <Input placeholder="ORD-20240101" value={form.orderNumber} onChange={(e) => set("orderNumber", e.target.value)} />
            </div>
          </div>

          {/* Install info (shown when status is INSTALLED) */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Install Date</Label>
              <Input type="date" value={form.installDate} onChange={(e) => set("installDate", e.target.value)} />
            </div>
            <div>
              <Label>Install Mileage</Label>
              <Input type="number" min="0" placeholder="52000" value={form.installMileage} onChange={(e) => set("installMileage", e.target.value)} />
            </div>
            <div>
              <Label>Labor Cost ($)</Label>
              <Input type="number" min="0" step="0.01" placeholder="0" value={form.laborCost} onChange={(e) => set("laborCost", e.target.value)} />
            </div>
          </div>

          {/* DIY checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="diyInstall"
              checked={form.diyInstall}
              onChange={(e) => set("diyInstall", e.target.checked)}
              className="rounded border-input"
            />
            <Label htmlFor="diyInstall" className="cursor-pointer">DIY Install</Label>
          </div>

          {/* Dependencies (edit mode only) */}
          {editMod && (
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5">
                <Link2 className="w-3.5 h-3.5" />
                Dependencies
                <span className="text-xs font-normal text-muted-foreground">(mods that must be done first)</span>
              </Label>

              {/* Current deps */}
              {deps.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {deps.map((d) => (
                    <Badge key={d.id} variant="secondary" className="gap-1 pr-1 text-xs">
                      {d.name}
                      <button
                        type="button"
                        className="ml-0.5 rounded hover:text-destructive"
                        onClick={() => removeDep(d.id)}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Search picker */}
              <div className="relative">
                <Input
                  placeholder="Search mods to add as dependency…"
                  value={depSearch}
                  onChange={(e) => { setDepSearch(e.target.value); setDepOpen(true); }}
                  onFocus={() => setDepOpen(true)}
                  onBlur={() => setTimeout(() => setDepOpen(false), 150)}
                  className="text-sm"
                />
                {depOpen && depSearch && (
                  <div className="absolute z-50 w-full mt-1 rounded-md border border-border bg-popover shadow-md max-h-48 overflow-y-auto">
                    {allVehicleMods
                      .filter((m) =>
                        !deps.some((d) => d.id === m.id) &&
                        m.name.toLowerCase().includes(depSearch.toLowerCase())
                      )
                      .slice(0, 10)
                      .map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between gap-2"
                          onMouseDown={(e) => { e.preventDefault(); addDep(m); }}
                        >
                          <span>{m.name}</span>
                          <span className="text-xs text-muted-foreground">{m.category}</span>
                        </button>
                      ))}
                    {allVehicleMods.filter((m) =>
                      !deps.some((d) => d.id === m.id) &&
                      m.name.toLowerCase().includes(depSearch.toLowerCase())
                    ).length === 0 && (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No mods found</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <textarea
              ref={notesRef}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[80px] resize-none overflow-hidden"
              placeholder="Any notes, fitment info, install tips…"
              value={form.notes}
              onChange={(e) => { set("notes", e.target.value); autoGrow(e.target); }}
              onFocus={(e) => autoGrow(e.target)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editMod ? "Save Changes" : "Add Modification"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
