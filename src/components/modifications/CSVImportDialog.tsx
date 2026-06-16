"use client";

import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { MOD_CATEGORIES } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
  onImported: () => void;
}

interface ParsedRow {
  name: string;
  category: string;
  brand?: string;
  vendor?: string;
  price?: number | null;
  status?: string;
  priority?: string;
  notes?: string;
}

// ── Simple CSV parser ─────────────────────────────────────────────────────────

function parseCSV(raw: string): { headers: string[]; rows: string[][] } {
  const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const cells: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        cells.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    return cells;
  };

  const headers = parseRow(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ""));
  const rows = lines.slice(1).map(parseRow);
  return { headers, rows };
}

const FIELD_ALIASES: Record<string, string> = {
  name: "name", partname: "name", modname: "name", modification: "name", item: "name",
  category: "category", cat: "category", type: "category",
  brand: "brand", manufacturer: "brand",
  vendor: "vendor", seller: "vendor", store: "vendor", shop: "vendor",
  price: "price", cost: "price", estimatedprice: "price",
  status: "status",
  priority: "priority",
  notes: "notes", description: "notes", note: "notes",
};

function mapHeaders(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    const field = FIELD_ALIASES[h];
    if (field && !(field in map)) map[field] = i;
  });
  return map;
}

// ── Component ─────────────────────────────────────────────────────────────────

const STATUSES  = ["PLANNED","RESEARCHING","ORDERED","PURCHASED","INSTALLED","REMOVED"];
const PRIORITIES = ["NONE","LOW","MEDIUM","HIGH","CRITICAL"];
const DEFAULT_CAT = MOD_CATEGORIES[0];

export function CSVImportDialog({ open, onOpenChange, vehicleId, onImported }: Props) {
  const { toast } = useToast();
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [defaultCategory, setDefaultCategory] = useState<string>(DEFAULT_CAT);
  const [defaultStatus, setDefaultStatus] = useState("PLANNED");
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<{ created: number; errors: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"input" | "preview">("input");

  const handleParse = () => {
    const { headers, rows } = parseCSV(raw);
    if (!headers.length) {
      toast({ title: "No data found — check your CSV format", variant: "destructive" });
      return;
    }
    const map = mapHeaders(headers);
    const result: ParsedRow[] = rows
      .filter((r) => r.some((c) => c.trim()))
      .map((cells) => {
        const get = (field: string) => (map[field] !== undefined ? (cells[map[field]] ?? "").trim() : "");
        const priceRaw = get("price").replace(/[$,]/g, "");
        return {
          name:     get("name") || "(no name)",
          category: get("category") || defaultCategory,
          brand:    get("brand") || undefined,
          vendor:   get("vendor") || undefined,
          price:    priceRaw ? parseFloat(priceRaw) || null : null,
          status:   get("status").toUpperCase() || defaultStatus,
          priority: get("priority").toUpperCase() || "NONE",
          notes:    get("notes") || undefined,
        };
      });

    setParsed(result);
    setStep("preview");
  };

  const handleImport = async () => {
    if (!parsed.length) return;
    setImporting(true);
    try {
      const rows = parsed.map((r) => ({
        ...r,
        status:   STATUSES.includes(r.status ?? "")  ? r.status   : defaultStatus,
        priority: PRIORITIES.includes(r.priority ?? "") ? r.priority : "NONE",
        category: r.category || defaultCategory,
      }));
      const res = await fetch(`/api/vehicles/${vehicleId}/modifications/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      setDone({ created: data.created, errors: data.errors?.length ?? 0 });
      onImported();
    } catch {
      toast({ title: "Import failed", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setRaw(""); setParsed([]); setStep("input"); setDone(null);
    setDefaultCategory(DEFAULT_CAT); setDefaultStatus("PLANNED");
  };

  const handleClose = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Mods from CSV</DialogTitle>
        </DialogHeader>

        {/* ── Done state ── */}
        {done && (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
            <p className="font-semibold">{done.created} mod{done.created !== 1 ? "s" : ""} imported!</p>
            {done.errors > 0 && <p className="text-xs text-muted-foreground">{done.errors} rows skipped due to errors</p>}
            <Button onClick={() => { handleClose(false); }} className="mt-2">Close</Button>
          </div>
        )}

        {/* ── Input step ── */}
        {!done && step === "input" && (
          <div className="space-y-4">
            <div className="p-4 bg-secondary/40 rounded-xl text-sm space-y-1.5">
              <p className="font-medium">Expected columns (any order, case-insensitive):</p>
              <p className="text-muted-foreground font-mono text-xs">name, category, brand, vendor, price, status, priority, notes</p>
              <p className="text-muted-foreground text-xs">Only <strong>name</strong> is required. Status values: {STATUSES.join(", ")}</p>
            </div>

            {/* Defaults */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Default category (for rows without one)</Label>
                <Select value={defaultCategory} onValueChange={setDefaultCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MOD_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Default status</Label>
                <Select value={defaultStatus} onValueChange={setDefaultStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Paste CSV or upload file</Label>
              <textarea
                className="w-full h-48 mt-1 rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder={`name,category,brand,price,status\nBC Racing Coilovers,Suspension,BC Racing,1200,PLANNED\nAPR Stage 2 ECU Tune,Engine / Drivetrain,APR,700,INSTALLED`}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3">
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => setRaw((ev.target?.result as string) ?? "");
                reader.readAsText(file);
              }} />
              <Button type="button" variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
                <Upload className="w-3.5 h-3.5" />
                Upload CSV file
              </Button>
              <span className="text-xs text-muted-foreground">or paste directly above</span>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button onClick={handleParse} disabled={!raw.trim()}>Preview Import →</Button>
            </DialogFooter>
          </div>
        )}

        {/* ── Preview step ── */}
        {!done && step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-sm font-medium">{parsed.length} rows ready to import</span>
            </div>

            <div className="border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      {["Name","Category","Brand","Vendor","Price","Status"].map((h) => (
                        <th key={h} className="text-left px-3 py-2 font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.slice(0, 50).map((row, i) => (
                      <tr key={i} className="border-b border-border/40 hover:bg-secondary/20">
                        <td className="px-3 py-2 font-medium max-w-[160px] truncate">{row.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.category}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.brand ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.vendor ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.price != null ? `$${row.price}` : "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.length > 50 && (
                  <p className="text-xs text-muted-foreground px-3 py-2">…and {parsed.length - 50} more rows</p>
                )}
              </div>
            </div>

            {parsed.some((r) => r.name === "(no name)") && (
              <div className="flex items-center gap-2 text-xs text-amber-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Some rows have no name — they will be imported as "(no name)"
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("input")}>← Back</Button>
              <Button onClick={handleImport} disabled={importing} className="bg-theme hover:brightness-90">
                {importing ? "Importing…" : `Import ${parsed.length} Mods`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
