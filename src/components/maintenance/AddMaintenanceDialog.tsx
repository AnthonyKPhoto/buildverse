"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface MaintenanceLog {
  id: string; vehicleId: string; service: string; mileage?: number | null;
  date: string; cost?: number | null; notes?: string; shop?: string;
  diy: boolean; nextDue?: string | null; nextMiles?: number | null;
}

interface AddMaintenanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
  onSaved: (log: MaintenanceLog) => void;
  editLog?: MaintenanceLog | null;
}

const COMMON_SERVICES = [
  "Oil Change", "Tire Rotation", "Brake Inspection", "Air Filter", "Cabin Filter",
  "Spark Plugs", "Coolant Flush", "Transmission Fluid", "Differential Fluid",
  "Brake Fluid", "Power Steering Fluid", "Alignment", "Wheel Balance",
  "Timing Belt/Chain", "Water Pump", "Serpentine Belt", "Battery Replacement",
  "Wiper Blades", "Fuel Filter", "Inspection / State Inspection",
];

export function AddMaintenanceDialog({ open, onOpenChange, vehicleId, onSaved, editLog }: AddMaintenanceDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    service: editLog?.service ?? "",
    date: editLog?.date ? editLog.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    mileage: editLog?.mileage?.toString() ?? "",
    cost: editLog?.cost?.toString() ?? "",
    shop: editLog?.shop ?? "",
    diy: editLog?.diy ?? false,
    notes: editLog?.notes ?? "",
    nextDue: editLog?.nextDue ? editLog.nextDue.slice(0, 10) : "",
    nextMiles: editLog?.nextMiles?.toString() ?? "",
  });

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.service || !form.date) {
      toast({ title: "Service and date are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        service: form.service,
        date: form.date,
        mileage: form.mileage ? parseInt(form.mileage) : undefined,
        cost: form.cost ? parseFloat(form.cost) : undefined,
        shop: form.shop || undefined,
        diy: form.diy,
        notes: form.notes || undefined,
        nextDue: form.nextDue || undefined,
        nextMiles: form.nextMiles ? parseInt(form.nextMiles) : undefined,
      };

      const url = editLog ? `/api/maintenance/${editLog.id}` : `/api/vehicles/${vehicleId}/maintenance`;
      const method = editLog ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      const log = await res.json();
      onSaved(log);
      onOpenChange(false);
      toast({ title: editLog ? "Log updated" : "Maintenance log added!" });
    } catch {
      toast({ title: "Failed to save maintenance log", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editLog ? "Edit Maintenance Log" : "Log Service"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Service */}
          <div>
            <Label>Service *</Label>
            <Input
              list="common-services"
              placeholder="Oil Change, Alignment…"
              value={form.service}
              onChange={(e) => set("service", e.target.value)}
              required
            />
            <datalist id="common-services">
              {COMMON_SERVICES.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>

          {/* Date / Mileage */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date *</Label>
              <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} required />
            </div>
            <div>
              <Label>Mileage</Label>
              <Input type="number" min="0" placeholder="52000" value={form.mileage} onChange={(e) => set("mileage", e.target.value)} />
            </div>
          </div>

          {/* Cost / Shop */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cost ($)</Label>
              <Input type="number" min="0" step="0.01" placeholder="89.99" value={form.cost} onChange={(e) => set("cost", e.target.value)} />
            </div>
            <div>
              <Label>Shop / Location</Label>
              <Input placeholder="Jiffy Lube, Home garage…" value={form.shop} onChange={(e) => set("shop", e.target.value)} />
            </div>
          </div>

          {/* DIY */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="diy"
              checked={form.diy}
              onChange={(e) => set("diy", e.target.checked)}
              className="rounded border-input"
            />
            <Label htmlFor="diy" className="cursor-pointer">DIY (self-performed)</Label>
          </div>

          {/* Next service */}
          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">Next Service Due</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Next Due Date</Label>
                <Input type="date" value={form.nextDue} onChange={(e) => set("nextDue", e.target.value)} />
              </div>
              <div>
                <Label>Next Due Mileage</Label>
                <Input type="number" min="0" placeholder="57500" value={form.nextMiles} onChange={(e) => set("nextMiles", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <textarea
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[70px] resize-none overflow-hidden"
              placeholder="Any notes about this service…"
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editLog ? "Save Changes" : "Log Service"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
