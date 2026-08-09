"use client";

import { useCallback, useEffect, useMemo, useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Gauge, Pencil, Pin, PinOff, Plus, Search, Trash2, Check, X } from "lucide-react";

// Replaces the old sticky-note board (color-coded cards, 3-star priority)
// with a dated timeline — see the Journal tab rework. VehicleNote's legacy
// `color`/`importance` columns still exist in the DB for data safety; this
// UI reads entryDate/mileage/pinned instead.

interface JournalEntry {
  id: string;
  vehicleId: string;
  title: string;
  content: string;
  entryDate: string;
  mileage: number | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EntryForm {
  title: string;
  content: string;
  entryDate: string; // yyyy-mm-dd, for <input type="date">
  mileage: string;
}

// Local-calendar-date helpers for <input type="date">. Deliberately avoid
// toISOString() for reading a date back out — it reports UTC, and shifts
// the displayed day backward by one in any timezone behind UTC. The
// Date object's plain (non-UTC) getters always reflect local time, so they
// round-trip correctly no matter what UTC instant is actually stored.
function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayInputValue(): string {
  return toDateInputValue(new Date());
}

function toInputValue(iso: string): string {
  return toDateInputValue(new Date(iso));
}

// The inverse: turn a "yyyy-mm-dd" <input type="date"> value into an ISO
// instant. Anchored at local noon (not midnight) before converting — a
// bare "yyyy-mm-ddT00:00:00" is close enough to a timezone boundary that a
// UTC+ timezone could push it to the *next* calendar day on save; noon
// gives headroom in both directions for any real-world UTC offset.
function fromDateInputValue(value: string): string {
  return new Date(`${value}T12:00:00`).toISOString();
}

const BLANK: EntryForm = { title: "", content: "", entryDate: todayInputValue(), mileage: "" };

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function dayParts(iso: string): { day: string; weekday: string } {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString("en-US", { day: "numeric" }),
    weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
  };
}

// A compact date/mileage/title/body form shared by the "add" composer and
// inline editing of an existing entry.
function EntryFields({
  form,
  onChange,
}: {
  form: EntryForm;
  onChange: (form: EntryForm) => void;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex gap-2">
        <Input
          type="date"
          value={form.entryDate}
          onChange={(e) => onChange({ ...form, entryDate: e.target.value })}
          className="w-40 text-sm"
        />
        <div className="relative flex-1 max-w-[160px]">
          <Gauge className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            type="number"
            inputMode="numeric"
            placeholder="Mileage"
            value={form.mileage}
            onChange={(e) => onChange({ ...form, mileage: e.target.value })}
            className="pl-8 text-sm"
          />
        </div>
      </div>
      <Input
        placeholder="Title (optional)"
        value={form.title}
        onChange={(e) => onChange({ ...form, title: e.target.value })}
        className="font-medium"
      />
      <Textarea
        placeholder="What happened? Parts installed, problems found, plans for next time…"
        value={form.content}
        onChange={(e) => onChange({ ...form, content: e.target.value })}
        className="min-h-[90px]"
      />
    </div>
  );
}

export function BuildLog({ vehicleId }: { vehicleId: string }) {
  const { toast } = useToast();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [pinnedOnly, setPinnedOnly] = useState(false);

  const [showComposer, setShowComposer] = useState(false);
  const [form, setForm] = useState<EntryForm>(BLANK);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EntryForm>(BLANK);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/notes`);
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter((e) => !pinnedOnly || e.pinned)
      .filter((e) => !q || e.title.toLowerCase().includes(q) || e.content.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
  }, [entries, query, pinnedOnly]);

  const groups = useMemo(() => {
    const out: { label: string; items: JournalEntry[] }[] = [];
    for (const entry of filtered) {
      const label = monthLabel(entry.entryDate);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(entry);
      else out.push({ label, items: [entry] });
    }
    return out;
  }, [filtered]);

  const openComposer = () => { setForm({ ...BLANK, entryDate: todayInputValue() }); setShowComposer(true); };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() && !form.content.trim()) {
      toast({ title: "Write something first", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          content: form.content,
          entryDate: form.entryDate ? fromDateInputValue(form.entryDate) : new Date().toISOString(),
          mileage: form.mileage ? Number(form.mileage) : null,
        }),
      });
      if (!res.ok) throw new Error();
      const entry = await res.json();
      setEntries((prev) => [entry, ...prev]);
      setShowComposer(false);
      toast({ title: "Entry added" });
    } catch {
      toast({ title: "Failed to save entry", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (entry: JournalEntry) => {
    setConfirmDeleteId(null);
    setEditingId(entry.id);
    setEditForm({
      title: entry.title,
      content: entry.content,
      entryDate: toInputValue(entry.entryDate),
      mileage: entry.mileage != null ? String(entry.mileage) : "",
    });
  };

  const saveEdit = async (id: string) => {
    const entryDateIso = editForm.entryDate ? fromDateInputValue(editForm.entryDate) : new Date().toISOString();
    const mileage = editForm.mileage ? Number(editForm.mileage) : null;
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, title: editForm.title, content: editForm.content, entryDate: entryDateIso, mileage } : e))
    );
    setEditingId(null);
    await fetch(`/api/vehicles/${vehicleId}/notes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editForm.title, content: editForm.content, entryDate: entryDateIso, mileage }),
    }).catch(() => {});
  };

  const togglePin = async (entry: JournalEntry) => {
    const pinned = !entry.pinned;
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, pinned } : e)));
    await fetch(`/api/vehicles/${vehicleId}/notes/${entry.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned }),
    }).catch(() => {});
  };

  const deleteEntry = async (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setConfirmDeleteId(null);
    if (editingId === id) setEditingId(null);
    await fetch(`/api/vehicles/${vehicleId}/notes/${id}`, { method: "DELETE" }).catch(() => {});
    toast({ title: "Entry deleted" });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Build Log</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {entries.length} entr{entries.length !== 1 ? "ies" : "y"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search entries…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 h-8 w-full sm:w-48 text-sm"
            />
          </div>
          <Button
            size="sm"
            variant={pinnedOnly ? "default" : "outline"}
            className={pinnedOnly ? "h-8 bg-theme hover:brightness-90 gap-1.5" : "h-8 gap-1.5"}
            onClick={() => setPinnedOnly((v) => !v)}
          >
            <Pin className="w-3.5 h-3.5" />
            Pinned
          </Button>
          <Button onClick={openComposer} size="sm" className="h-8 bg-theme hover:brightness-90 gap-1.5">
            <Plus className="w-4 h-4" />
            Add Entry
          </Button>
        </div>
      </div>

      {/* Composer */}
      {showComposer && (
        <form onSubmit={handleAdd} className="rounded-xl border border-theme/30 bg-theme/5 p-4 space-y-3">
          <EntryFields form={form} onChange={setForm} />
          <div className="flex gap-2 justify-end">
            <Button type="button" size="sm" variant="outline" onClick={() => setShowComposer(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving} className="bg-theme hover:brightness-90 gap-1.5">
              {saving ? "Saving…" : "Save Entry"}
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm py-10">
          <div className="w-4 h-4 border-2 border-theme border-t-transparent rounded-full animate-spin" />
          Loading…
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-border">
          <div className="w-14 h-14 rounded-2xl bg-theme/10 flex items-center justify-center mb-4">
            <BookOpen className="w-7 h-7 text-theme" />
          </div>
          <p className="font-semibold mb-1">No entries yet</p>
          <p className="text-sm text-muted-foreground mb-5">Start logging the build — parts, problems, plans</p>
          <Button onClick={openComposer} size="sm" className="bg-theme hover:brightness-90 gap-2">
            <Plus className="w-4 h-4" /> Add First Entry
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">No entries match your search.</div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <div key={group.label}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{group.label}</h3>
              <div className="relative pl-12 sm:pl-14">
                <div className="absolute left-[15px] sm:left-[17px] top-1 bottom-1 w-px bg-border" />
                <div className="space-y-4">
                  {group.items.map((entry) => {
                    const { day, weekday } = dayParts(entry.entryDate);
                    const isEditing = editingId === entry.id;
                    return (
                      <div key={entry.id} className="relative">
                        <div className="absolute -left-12 sm:-left-14 top-0 w-9 sm:w-11 text-right">
                          <div className="text-sm font-semibold leading-none">{day}</div>
                          <div className="text-[10px] text-muted-foreground uppercase mt-0.5">{weekday}</div>
                        </div>
                        <div className="absolute left-[-25px] sm:left-[-29px] top-1 w-2.5 h-2.5 rounded-full bg-theme ring-4 ring-background" />

                        <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
                          {isEditing ? (
                            <div className="space-y-3">
                              <EntryFields form={editForm} onChange={setEditForm} />
                              <div className="flex gap-2 justify-end">
                                <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                                  <X className="w-3.5 h-3.5" /> Cancel
                                </Button>
                                <Button size="sm" className="bg-theme hover:brightness-90 gap-1.5" onClick={() => saveEdit(entry.id)}>
                                  <Check className="w-3.5 h-3.5" /> Save
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {entry.title && <h4 className="font-semibold text-sm truncate">{entry.title}</h4>}
                                    {entry.mileage != null && (
                                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
                                        <Gauge className="w-3 h-3" /> {entry.mileage.toLocaleString()} mi
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <Button
                                    size="sm" variant="ghost"
                                    className={`h-7 w-7 p-0 ${entry.pinned ? "text-theme" : "text-muted-foreground hover:text-theme"}`}
                                    title={entry.pinned ? "Unpin" : "Pin"}
                                    onClick={() => togglePin(entry)}
                                  >
                                    {entry.pinned ? <Pin className="w-3.5 h-3.5 fill-current" /> : <PinOff className="w-3.5 h-3.5" />}
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={() => startEdit(entry)}>
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    size="sm" variant="ghost"
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => setConfirmDeleteId(confirmDeleteId === entry.id ? null : entry.id)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                              {entry.content && (
                                <p className="text-sm text-muted-foreground/90 mt-2 whitespace-pre-wrap leading-relaxed">{entry.content}</p>
                              )}
                              {confirmDeleteId === entry.id && (
                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/30">
                                  <p className="text-xs text-muted-foreground flex-1">Delete this entry?</p>
                                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                                  <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => deleteEntry(entry.id)}>Delete</Button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
