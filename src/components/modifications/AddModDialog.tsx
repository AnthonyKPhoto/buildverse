"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { MOD_CATEGORIES, INSTALL_DIFFICULTIES } from "@/lib/utils";
import { useCategories } from "@/hooks/use-categories";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { AutocompleteInput } from "@/components/ui/AutocompleteInput";
import { Link2, Loader2, CheckCircle2, ArrowLeft, Sparkles, ChevronRight } from "lucide-react";

interface Suggestions { brands: string[]; vendors: string[]; names: string[]; }
interface VehicleMod { id: string; name: string; status: string; category: string; }

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
const STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planned", RESEARCHING: "Researching / Idea", ORDERED: "Ordered",
  PURCHASED: "Purchased", INSTALLED: "Installed", REMOVED: "Removed",
};
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

function extractDomain(url: string) {
  try { return new URL(url).hostname.replace("www.", ""); } catch { return url; }
}

// ── Scraping animation ────────────────────────────────────────────────────────

const SCRAPE_PHASES = ["Connecting to site…", "Reading product page…", "Extracting details…"];

function ScrapingView({ url }: { url: string }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 3000);
    const t2 = setTimeout(() => setPhase(2), 7000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div className="flex flex-col items-center py-10 gap-5">
      <div className="w-14 h-14 rounded-2xl bg-theme/10 flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-theme animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">{SCRAPE_PHASES[phase]}</p>
        <p className="text-xs text-muted-foreground mt-1">{extractDomain(url)}</p>
      </div>
      <div className="flex gap-1.5">
        {SCRAPE_PHASES.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i <= phase ? "w-4 bg-theme" : "w-1.5 bg-border"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ── Dependency picker ─────────────────────────────────────────────────────────

function DepPicker({
  vehicleMods,
  dependsOn,
  onChange,
}: {
  vehicleMods: VehicleMod[];
  dependsOn: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");

  const toggle = (id: string, checked: boolean) =>
    onChange(checked ? [...dependsOn, id] : dependsOn.filter((x) => x !== id));

  const selectedMods = vehicleMods.filter((m) => dependsOn.includes(m.id));
  const filtered = vehicleMods
    .filter((m) =>
      !search.trim() ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.category.toLowerCase().includes(search.toLowerCase())
    )
    // Float selected items to the top of the list
    .sort((a, b) => {
      const asel = dependsOn.includes(a.id) ? 0 : 1;
      const bsel = dependsOn.includes(b.id) ? 0 : 1;
      return asel - bsel;
    });

  return (
    <details className="group">
      <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground list-none select-none">
        <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90 shrink-0" />
        Dependencies
        {dependsOn.length > 0 && (
          <span className="ml-1 text-xs bg-theme/15 text-theme px-1.5 py-0.5 rounded-full">
            {dependsOn.length} required
          </span>
        )}
      </summary>

      {/* Selected chips — visible even when the list is collapsed */}
      {selectedMods.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedMods.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-1 text-xs bg-theme/10 text-theme border border-theme/25 rounded-full px-2.5 py-1 font-medium"
            >
              {m.name}
              <button
                type="button"
                className="ml-0.5 hover:text-destructive transition-colors"
                onClick={() => toggle(m.id, false)}
                title="Remove"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 border border-input rounded-xl overflow-hidden">
        {/* Search bar */}
        <div className="px-2 pt-2 pb-1">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search mods…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-secondary/40 rounded-lg border-0 outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground px-3 pb-1.5">Mods that must be installed before this one</p>
        <div className="space-y-0.5 max-h-44 overflow-y-auto px-2 pb-2">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-3 text-center">No mods match</p>
          ) : filtered.map((m) => {
            const selected = dependsOn.includes(m.id);
            return (
              <label
                key={m.id}
                className={`flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded-lg transition-colors ${
                  selected ? "bg-theme/8 hover:bg-theme/12" : "hover:bg-secondary/40"
                }`}
              >
                <input
                  type="checkbox"
                  className="rounded border-input accent-theme"
                  checked={selected}
                  onChange={(e) => toggle(m.id, e.target.checked)}
                />
                <span className={`text-sm flex-1 truncate ${selected ? "font-medium text-theme" : ""}`}>
                  {m.name}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">{m.category}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full border shrink-0 ${
                  m.status === "INSTALLED" ? "bg-green-500/15 text-green-400 border-green-500/25" :
                  m.status === "PLANNED"   ? "bg-slate-500/15 text-slate-400 border-slate-500/25" :
                  "bg-yellow-500/15 text-yellow-400 border-yellow-500/25"
                }`}>
                  {m.status.charAt(0) + m.status.slice(1).toLowerCase()}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </details>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AddModDialog({ open, onOpenChange, vehicleId, onSaved, editMod }: AddModDialogProps) {
  const { toast } = useToast();
  const { categories: modCategories } = useCategories();
  const [saving, setSaving] = useState(false);
  const [fetchingImage, setFetchingImage] = useState(false);
  const [form, setForm] = useState(formFromMod(editMod));
  const [suggestions, setSuggestions] = useState<Suggestions>({ brands: [], vendors: [], names: [] });
  const [vehicleMods, setVehicleMods] = useState<VehicleMod[]>([]);
  const [dependsOn, setDependsOn] = useState<string[]>([]);

  // URL step
  const [step, setStep] = useState<"url" | "form">(editMod ? "form" : "url");
  const [urlInput, setUrlInput] = useState("");
  const [scraping, setScraping] = useState(false);
  const [autoFilled, setAutoFilled] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/suggestions")
      .then((r) => r.json())
      .then((d) => { if (d.brands) setSuggestions(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (open) {
      setForm(formFromMod(editMod));
      setStep(editMod ? "form" : "url");
      setUrlInput("");
      setScraping(false);
      setAutoFilled([]);
      setDependsOn([]);

      // Fetch all other mods for this vehicle for dependency selector
      fetch(`/api/vehicles/${vehicleId}/modifications`)
        .then((r) => r.json())
        .then((data: VehicleMod[]) => {
          if (Array.isArray(data)) setVehicleMods(data.filter((m) => m.id !== editMod?.id));
        })
        .catch(() => {});

      // Fetch existing dependencies when editing
      if (editMod) {
        fetch(`/api/modifications/${editMod.id}/dependencies`)
          .then((r) => r.json())
          .then((data: { id: string }[]) => {
            if (Array.isArray(data)) setDependsOn(data.map((m) => m.id));
          })
          .catch(() => {});
      }
    } else {
      abortRef.current?.abort();
    }
  }, [open, editMod, vehicleId]);

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  // ── Scrape ──────────────────────────────────────────────────────────────────

  const handleScrape = async () => {
    const url = urlInput.trim();
    if (!url) return;

    setScraping(true);
    abortRef.current = new AbortController();
    const timer = setTimeout(() => abortRef.current?.abort(), 15000);

    try {
      const res = await fetch(`/api/scrape-mod?url=${encodeURIComponent(url)}`, {
        signal: abortRef.current.signal,
      });
      clearTimeout(timer);

      if (!res.ok) throw new Error("scrape failed");
      const data = await res.json();

      const filled: string[] = [];
      const updates: Partial<typeof BLANK_FORM> = { link: url };

      if (data.name)          { updates.name = data.name;             filled.push("name"); }
      if (data.brand)         { updates.brand = data.brand;           filled.push("brand"); }
      if (data.vendor)        { updates.vendor = data.vendor;         filled.push("vendor"); }
      if (data.price != null) { updates.price = String(data.price);   filled.push("price"); }
      if (data.imageUrl)      { updates.imageUrl = data.imageUrl;     filled.push("photo"); }
      if (data.notes)         { updates.notes = data.notes;           filled.push("notes"); }
      if (data.partNumber)    { updates.partNumber = data.partNumber; filled.push("part number"); }

      setForm((f) => ({ ...f, ...updates }));
      setAutoFilled(filled);
    } catch {
      clearTimeout(timer);
      setForm((f) => ({ ...f, link: url }));
      setAutoFilled([]);
      toast({ title: "Couldn't auto-fill", description: "Fill in the details manually." });
    } finally {
      setScraping(false);
      setStep("form");
    }
  };

  // ── Image auto-fetch on link blur ───────────────────────────────────────────

  const handleLinkBlur = async () => {
    if (!form.link || form.imageUrl || fetchingImage) return;
    setFetchingImage(true);
    try {
      const res = await fetch(`/api/scrape-image?url=${encodeURIComponent(form.link)}`);
      const data = await res.json();
      if (data.imageUrl) set("imageUrl", data.imageUrl);
    } catch {
      // silently ignore
    } finally {
      setFetchingImage(false);
    }
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

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

      const url    = editMod ? `/api/modifications/${editMod.id}` : `/api/vehicles/${vehicleId}/modifications`;
      const method = editMod ? "PUT" : "POST";
      const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      const mod = await res.json();

      // Sync dependencies
      await fetch(`/api/modifications/${mod.id}/dependencies`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dependsOn }),
      }).catch(() => {});

      if (form.link) {
        const autoTrack = localStorage.getItem("bv_autoTrackProducts");
        const shouldTrack = autoTrack === null ? true : autoTrack === "true";
        if (shouldTrack) {
          fetch("/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: form.link }),
          }).catch(() => {});
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

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl flex flex-col max-h-[92vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
          <DialogTitle>{editMod ? "Edit Modification" : "Add Modification"}</DialogTitle>
        </DialogHeader>

        {/* ── Scrollable body ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">

        {/* ── Step 0: URL entry ─────────────────────────────────────────── */}
        {step === "url" && !editMod && (
          <div className="py-2">
            {scraping ? (
              <ScrapingView url={urlInput} />
            ) : (
              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5 px-4 py-3.5 rounded-xl bg-theme/5 border border-theme/15">
                    <Sparkles className="w-4 h-4 text-theme flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      Paste a product link and we&apos;ll auto-fill the name, brand, price, and photo.
                    </p>
                  </div>

                  <div>
                    <Label className="mb-1.5 block">Product URL</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <Input
                          className="pl-9"
                          placeholder="https://ecstuning.com/product/…"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleScrape(); } }}
                          autoFocus
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={handleScrape}
                        disabled={!urlInput.trim()}
                        className="bg-theme hover:brightness-90 shrink-0"
                      >
                        Auto-fill
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full h-px bg-border" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-background px-3 text-xs text-muted-foreground">or</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setStep("form")}
                >
                  Skip — fill in manually
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 1: Form ──────────────────────────────────────────────── */}
        {step === "form" && (
          <form id="mod-form" onSubmit={handleSubmit} className="space-y-4">

            {/* Auto-fill banner */}
            {autoFilled.length > 0 && (
              <div className="flex items-start gap-2.5 px-3.5 py-3 bg-green-500/8 border border-green-500/20 rounded-xl">
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-400">Auto-filled from URL</p>
                  <p className="text-xs text-green-400/70 mt-0.5">
                    {autoFilled.join(", ")} — verify and edit before adding
                  </p>
                </div>
                {!editMod && (
                  <button
                    type="button"
                    onClick={() => { setStep("url"); setAutoFilled([]); }}
                    className="flex items-center gap-1 text-2xs text-green-400/60 hover:text-green-400 transition-colors flex-shrink-0"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Change URL
                  </button>
                )}
              </div>
            )}

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
                    {modCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s] ?? s}</SelectItem>)}
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

            {/* Link */}
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

            {/* Install info */}
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

            {/* Dependencies */}
            {vehicleMods.length > 0 && (
              <DepPicker
                vehicleMods={vehicleMods}
                dependsOn={dependsOn}
                onChange={setDependsOn}
              />
            )}

            {/* Notes */}
            <div>
              <Label>Notes</Label>
              <textarea
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[80px] resize-none overflow-hidden"
                placeholder="Any notes, fitment info, install tips…"
                value={form.notes}
                onChange={(e) => {
                  set("notes", e.target.value);
                  const t = e.target; t.style.height = "auto"; t.style.height = t.scrollHeight + "px";
                }}
                onFocus={(e) => {
                  const t = e.target; t.style.height = "auto"; t.style.height = t.scrollHeight + "px";
                }}
              />
            </div>

          </form>
        )}

        </div>{/* end scrollable body */}

        {/* ── Sticky footer ─────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-border flex-shrink-0 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {step === "form" && (
            <Button type="submit" form="mod-form" disabled={saving || fetchingImage}>
              {saving ? "Saving…" : editMod ? "Save Changes" : "Add Modification"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
