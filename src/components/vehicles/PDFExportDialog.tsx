"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Modification {
  id: string; name: string; category: string; vendor?: string; brand?: string;
  price?: number | null; actualPrice?: number | null; notes?: string;
  status: string; priority: string; installDate?: string; difficulty?: string;
  partNumber?: string;
}
interface MaintenanceLog {
  id: string; service: string; date: string; mileage?: number | null;
  cost?: number | null; notes?: string; shop?: string; diy: boolean;
}
interface Vehicle {
  id: string; name?: string; year: number; make: string; model: string;
  trim?: string; platform?: string; engine?: string; transmission?: string;
  drivetrain?: string; mileage?: number; color?: string; photoUrl?: string;
  notes?: string;
  modifications: Modification[];
  maintenanceLogs: MaintenanceLog[];
}

export interface BuildSheetOptions {
  includeInstalled: boolean;
  includePlanned: boolean;
  includeCarPhoto: boolean;
  includeJournal: boolean;
  font: "Helvetica" | "Times-Roman" | "Courier";
  style: "modern" | "minimal" | "classic";
}

interface PDFExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle;
}

function Toggle({
  label, description, checked, onChange, disabled,
}: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
        disabled
          ? "opacity-40 cursor-not-allowed border-border"
          : checked
            ? "border-theme/50 bg-theme/5"
            : "border-border hover:border-border/80 bg-transparent"
      }`}
    >
      <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
        checked && !disabled ? "bg-theme border-theme" : "border-muted-foreground/40 bg-transparent"
      }`}>
        {checked && !disabled && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    </button>
  );
}

export function PDFExportDialog({ open, onOpenChange, vehicle }: PDFExportDialogProps) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [options, setOptions] = useState<BuildSheetOptions>({
    includeInstalled: true,
    includePlanned: true,
    includeCarPhoto: true,
    includeJournal: true,
    font: "Helvetica",
    style: "modern",
  });

  const set = <K extends keyof BuildSheetOptions>(k: K, v: BuildSheetOptions[K]) =>
    setOptions((prev) => ({ ...prev, [k]: v }));

  const hasPhoto = !!(vehicle.photoUrl);
  const hasJournal = !!(vehicle.notes?.trim());
  const installedCount = vehicle.modifications.filter((m) => m.status === "INSTALLED").length;
  const plannedCount = vehicle.modifications.filter((m) => m.status !== "INSTALLED" && m.status !== "REMOVED").length;

  const handleExport = async () => {
    setExporting(true);
    try {
      const [{ pdf }, { BuildSheetDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/vehicles/BuildSheetPDF"),
      ]);
      const accentColor = typeof window !== "undefined"
        ? (localStorage.getItem("bv-accent") || "#e84d3d")
        : "#e84d3d";
      const blob = await pdf(
        <BuildSheetDocument vehicle={vehicle} accentColor={accentColor} options={options} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(vehicle.name || `${vehicle.year}-${vehicle.make}-${vehicle.model}`).replace(/\s+/g, "-")}-build-sheet.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Export failed", description: String(err), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="w-4 h-4" />
            Export Build Sheet
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Sections */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Include Sections</Label>
            <div className="space-y-1.5">
              <Toggle
                label="Installed Mods"
                description={installedCount > 0 ? `${installedCount} mod${installedCount !== 1 ? "s" : ""}` : "None yet"}
                checked={options.includeInstalled}
                onChange={(v) => set("includeInstalled", v)}
                disabled={installedCount === 0}
              />
              <Toggle
                label="Planned / In-Progress Mods"
                description={plannedCount > 0 ? `${plannedCount} mod${plannedCount !== 1 ? "s" : ""}` : "None"}
                checked={options.includePlanned}
                onChange={(v) => set("includePlanned", v)}
                disabled={plannedCount === 0}
              />
              <Toggle
                label="Vehicle Photo"
                description={hasPhoto ? "Cover image on first page" : "No photo uploaded"}
                checked={options.includeCarPhoto && hasPhoto}
                onChange={(v) => set("includeCarPhoto", v)}
                disabled={!hasPhoto}
              />
              <Toggle
                label="Build Journal"
                description={hasJournal ? "Notes on a dedicated page" : "Journal is empty"}
                checked={options.includeJournal && hasJournal}
                onChange={(v) => set("includeJournal", v)}
                disabled={!hasJournal}
              />
            </div>
          </div>

          {/* Style */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Font</Label>
              <Select value={options.font} onValueChange={(v) => set("font", v as BuildSheetOptions["font"])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Helvetica">Helvetica</SelectItem>
                  <SelectItem value="Times-Roman">Times Roman</SelectItem>
                  <SelectItem value="Courier">Courier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Style</Label>
              <Select value={options.style} onValueChange={(v) => set("style", v as BuildSheetOptions["style"])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="modern">Modern</SelectItem>
                  <SelectItem value="minimal">Minimal</SelectItem>
                  <SelectItem value="classic">Classic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview hint */}
          <p className="text-xs text-muted-foreground">
            {options.style === "modern" && "Colored stat boxes, shaded rows, clean layout."}
            {options.style === "minimal" && "Stripped back — plain text, no backgrounds, printer-friendly."}
            {options.style === "classic" && "Warm tones with a traditional document feel."}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exporting}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={exporting || (!options.includeInstalled && !options.includePlanned)}
            className="gap-2 bg-theme hover:brightness-90"
          >
            <FileDown className="w-4 h-4" />
            {exporting ? "Generating…" : "Download PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
