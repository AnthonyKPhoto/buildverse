"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Gauge } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface DynoRun {
  id: string;
  vehicleId: string;
  date: string;
  hp?: number | null;
  torque?: number | null;
  label?: string | null;
  notes?: string | null;
  createdAt: string;
}

const BLANK = { date: "", hp: "", torque: "", label: "", notes: "" };

export function DynoTab({ vehicleId }: { vehicleId: string }) {
  const { toast } = useToast();
  const [runs, setRuns] = useState<DynoRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/dyno`);
      const data = await res.json();
      setRuns(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => { load(); }, [load]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date) { toast({ title: "Date required", variant: "destructive" }); return; }
    if (!form.hp && !form.torque) { toast({ title: "Enter at least HP or torque", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/dyno`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date,
          hp: form.hp ? parseFloat(form.hp) : null,
          torque: form.torque ? parseFloat(form.torque) : null,
          label: form.label || null,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) throw new Error();
      const run = await res.json();
      setRuns((prev) => [...prev, run].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      setForm(BLANK);
      setShowForm(false);
      toast({ title: "Dyno run added" });
    } catch {
      toast({ title: "Failed to save run", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteRun = async (id: string) => {
    await fetch(`/api/vehicles/${vehicleId}/dyno/${id}`, { method: "DELETE" });
    setRuns((prev) => prev.filter((r) => r.id !== id));
    toast({ title: "Run deleted" });
  };

  const chartData = runs.map((r) => ({
    name: r.label || new Date(r.date).toLocaleDateString(),
    HP: r.hp ?? undefined,
    Torque: r.torque ?? undefined,
  }));

  const maxHP     = Math.max(0, ...runs.map((r) => r.hp ?? 0));
  const maxTorque = Math.max(0, ...runs.map((r) => r.torque ?? 0));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
        <div className="w-4 h-4 border-2 border-theme border-t-transparent rounded-full animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats + chart */}
      {runs.length >= 2 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gauge className="w-4 h-4 text-theme" />
              Performance Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6 mb-4">
              {maxHP > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Peak HP</p>
                  <p className="text-xl font-bold text-theme">{maxHP.toFixed(0)}<span className="text-xs font-normal ml-1">hp</span></p>
                </div>
              )}
              {maxTorque > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Peak Torque</p>
                  <p className="text-xl font-bold text-orange-400">{maxTorque.toFixed(0)}<span className="text-xs font-normal ml-1">lb-ft</span></p>
                </div>
              )}
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {runs.some((r) => r.hp != null) && (
                  <Line type="monotone" dataKey="HP" stroke="var(--theme, #8b5cf6)" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                )}
                {runs.some((r) => r.torque != null) && (
                  <Line type="monotone" dataKey="Torque" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                )}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Add form */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Dyno Runs ({runs.length})</h3>
        <Button size="sm" onClick={() => setShowForm((s) => !s)} className="gap-1.5 bg-theme hover:brightness-90">
          <Plus className="w-3.5 h-3.5" />
          Add Run
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-5">
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Date *</Label>
                  <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
                </div>
                <div>
                  <Label>Label / Tune Stage</Label>
                  <Input placeholder="Stage 2, Flex E30…" value={form.label} onChange={(e) => set("label", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Horsepower (hp)</Label>
                  <Input type="number" min="0" step="0.1" placeholder="320" value={form.hp} onChange={(e) => set("hp", e.target.value)} />
                </div>
                <div>
                  <Label>Torque (lb-ft)</Label>
                  <Input type="number" min="0" step="0.1" placeholder="380" value={form.torque} onChange={(e) => set("torque", e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Input placeholder="Conditions, boost level, fuel…" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving…" : "Add Run"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Run list */}
      {runs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Gauge className="w-10 h-10 mx-auto mb-3 opacity-25" />
          <p className="text-sm">No dyno runs yet — add your first run to start tracking performance</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...runs].reverse().map((run) => (
            <div key={run.id} className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:bg-secondary/40 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {run.label && <span className="text-sm font-semibold">{run.label}</span>}
                  <span className="text-xs text-muted-foreground">{new Date(run.date).toLocaleDateString()}</span>
                </div>
                <div className="flex gap-4 mt-1">
                  {run.hp    != null && <span className="text-sm font-medium text-theme">{run.hp} hp</span>}
                  {run.torque != null && <span className="text-sm font-medium text-orange-400">{run.torque} lb-ft</span>}
                </div>
                {run.notes && <p className="text-xs text-muted-foreground mt-0.5">{run.notes}</p>}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                onClick={() => deleteRun(run.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
