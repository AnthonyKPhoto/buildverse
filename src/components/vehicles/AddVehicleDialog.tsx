"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { VEHICLE_MAKES } from "@/lib/utils";

interface AddVehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (vehicle: unknown) => void;
  editVehicle?: {
    id: string; name?: string; year: number; make: string; model: string; trim?: string;
    engine?: string; transmission?: string; drivetrain?: string; vin?: string;
    mileage?: number; platform?: string; color?: string; photoUrl?: string; notes?: string;
  } | null;
}

const DRIVETRAINS = ["FWD", "RWD", "AWD", "4WD", "4x4"];
const TRANSMISSIONS = ["Manual", "Automatic", "DCT", "CVT", "Semi-Auto"];

export function AddVehicleDialog({ open, onOpenChange, onCreated, editVehicle }: AddVehicleDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: editVehicle?.name ?? "",
    year: editVehicle?.year?.toString() ?? new Date().getFullYear().toString(),
    make: editVehicle?.make ?? "",
    model: editVehicle?.model ?? "",
    trim: editVehicle?.trim ?? "",
    engine: editVehicle?.engine ?? "",
    transmission: editVehicle?.transmission ?? "",
    drivetrain: editVehicle?.drivetrain ?? "",
    vin: editVehicle?.vin ?? "",
    mileage: editVehicle?.mileage?.toString() ?? "",
    platform: editVehicle?.platform ?? "",
    color: editVehicle?.color ?? "",
    photoUrl: editVehicle?.photoUrl ?? "",
    notes: editVehicle?.notes ?? "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.year || !form.make || !form.model) {
      toast({ title: "Year, make, and model are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name || undefined,
        year: parseInt(form.year),
        make: form.make,
        model: form.model,
        trim: form.trim || undefined,
        engine: form.engine || undefined,
        transmission: form.transmission || undefined,
        drivetrain: form.drivetrain || undefined,
        vin: form.vin || undefined,
        mileage: form.mileage ? parseInt(form.mileage) : undefined,
        platform: form.platform || undefined,
        color: form.color || undefined,
        photoUrl: form.photoUrl || undefined,
        notes: form.notes || undefined,
      };

      const url = editVehicle ? `/api/vehicles/${editVehicle.id}` : "/api/vehicles";
      const method = editVehicle ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      const vehicle = await res.json();
      onCreated(vehicle);
      onOpenChange(false);
      toast({ title: editVehicle ? "Vehicle updated" : "Vehicle added to your garage!" });
    } catch {
      toast({ title: "Failed to save vehicle", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editVehicle ? "Edit Vehicle" : "Add Vehicle to Garage"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nickname */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Nickname (optional)</Label>
              <Input placeholder="e.g. The Daily, Track Car…" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
          </div>

          {/* Year / Make / Model */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Year *</Label>
              <Input type="number" min="1900" max="2030" placeholder="2019" value={form.year} onChange={(e) => set("year", e.target.value)} required />
            </div>
            <div>
              <Label>Make *</Label>
              <Select value={form.make} onValueChange={(v) => set("make", v)}>
                <SelectTrigger><SelectValue placeholder="Select make" /></SelectTrigger>
                <SelectContent>
                  {VEHICLE_MAKES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Model *</Label>
              <Input placeholder="A4, Civic, S2000…" value={form.model} onChange={(e) => set("model", e.target.value)} required />
            </div>
          </div>

          {/* Trim / Platform */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Trim</Label>
              <Input placeholder="Premium Plus, Sport…" value={form.trim} onChange={(e) => set("trim", e.target.value)} />
            </div>
            <div>
              <Label>Platform / Chassis</Label>
              <Input placeholder="B9, FK8, AP2…" value={form.platform} onChange={(e) => set("platform", e.target.value)} />
            </div>
          </div>

          {/* Engine / Transmission / Drivetrain */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Engine</Label>
              <Input placeholder="2.0T, K20C1…" value={form.engine} onChange={(e) => set("engine", e.target.value)} />
            </div>
            <div>
              <Label>Transmission</Label>
              <Select value={form.transmission} onValueChange={(v) => set("transmission", v)}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {TRANSMISSIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Drivetrain</Label>
              <Select value={form.drivetrain} onValueChange={(v) => set("drivetrain", v)}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {DRIVETRAINS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* VIN / Mileage / Color */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>VIN</Label>
              <Input placeholder="17-character VIN" value={form.vin} onChange={(e) => set("vin", e.target.value)} />
            </div>
            <div>
              <Label>Mileage</Label>
              <Input type="number" min="0" placeholder="47500" value={form.mileage} onChange={(e) => set("mileage", e.target.value)} />
            </div>
            <div>
              <Label>Color</Label>
              <Input placeholder="Mythos Black…" value={form.color} onChange={(e) => set("color", e.target.value)} />
            </div>
          </div>

          {/* Photo URL */}
          <div>
            <Label>Photo URL</Label>
            <Input placeholder="https://…" value={form.photoUrl} onChange={(e) => set("photoUrl", e.target.value)} />
          </div>

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <textarea
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[80px] resize-none"
              placeholder="Any additional notes about this build…"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editVehicle ? "Save Changes" : "Add Vehicle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
