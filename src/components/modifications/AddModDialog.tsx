"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { MOD_CATEGORIES, INSTALL_DIFFICULTIES } from "@/lib/utils";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { AutocompleteInput } from "@/components/ui/AutocompleteInput";

interface Suggestions { brands: string[]; vendors: string[]; names: string[]; }

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
const PRIORITIES = [
  { value: "NONE",     label: "—  None" },
  { value: "LOW",      label: "Low" },
  { value: "MEDIUM",   label: "Medium" },
  { value: "HIGH",     label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

const BLANK_FORM = {
  name: "", category: "", brand: "", vendor: "", price: "", actualPrice: "",
  status: "PLANNED", priority: "NONE", difficulty: "UNKNOWN",
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
    priority: m.priority ?? "NONE",
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
  const [fetchingImage, setFetchingImage] = useState(false);
  const [form, setForm] = useState(formFromMod(editMod));
  const [suggestions, setSuggestions] = useState<Suggestions>({ brands: [], vendors: [], names: [] });

  useEffect(() => {
    fetch("/api/suggestions")
      .then((r) => r.json())
      .then((d) => { if (d.brands) setSuggestions(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (open) setForm(formFromMod(editMod));
  }, [open, editMod]);

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const handleLinkBlur = async () => {
    if (!form.link || form.imageUrl || fetchingImage) return;
    setFetchingImage(true);
    try {
      const res = await fetch(`/api/scrape-image?url=${encodeURIComponent(form.link)}`);
      const data = await res.json();
      if (data.imageUrl) set("imageUrl", data.imageUrl);
    } catch {
      // silently ignore — user can paste image URL manually
    } finally {
      setFetchingImage(false);
    }
  };

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
        link: form.link || null,
        imageUrl: form.imageUrl || null,
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
                  {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
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

          {/* Link — blurring auto-fetches the product image if none is set yet */}
          <div>
            <Label className="flex items-center gap-2">
              Product Link
              {fetchingImage && (
                <span className="text-xs text-muted-foreground font-normal flex items-center gap-1">
                  <span className="w-3 h-3 border border-muted-foreground border-t-transparent rounded-full animate-spin inline-block" />
                  fetching image…
                </span>
              )}
            </Label>
            <Input
              placeholder="https://ecstuning.com/…"
              value={form.link}
              onChange={(e) => set("link", e.target.value)}
              onBlur={handleLinkBlur}
            />
            {!form.imageUrl && !fetchingImage && form.link && (
              <p className="text-xs text-muted-foreground mt-1">Image will auto-fill when you leave this field</p>
            )}
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

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <textarea
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[80px] resize-none"
              placeholder="Any notes, fitment info, install tips…"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || fetchingImage}>
              {saving ? "Saving…" : editMod ? "Save Changes" : "Add Modification"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
