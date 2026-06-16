"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Plus, Trash2, Link, Edit2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VehicleLink {
  id: string; vehicleId: string; title: string; url: string;
  description?: string | null; category?: string | null; createdAt: string;
}

const CATEGORIES = ["Forum Thread", "YouTube Video", "Tutorial", "Parts Reference", "Spec Sheet", "Vendor", "Other"];

const CATEGORY_COLORS: Record<string, string> = {
  "Forum Thread":   "bg-blue-500/15 text-blue-400 border-blue-500/25",
  "YouTube Video":  "bg-red-500/15 text-red-400 border-red-500/25",
  "Tutorial":       "bg-green-500/15 text-green-400 border-green-500/25",
  "Parts Reference":"bg-purple-500/15 text-purple-400 border-purple-500/25",
  "Spec Sheet":     "bg-amber-500/15 text-amber-400 border-amber-500/25",
  "Vendor":         "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  "Other":          "bg-secondary text-muted-foreground border-border",
};

interface FormState { title: string; url: string; description: string; category: string; }
const EMPTY_FORM: FormState = { title: "", url: "", description: "", category: "" };

export function LinksTab({ vehicleId }: { vehicleId: string }) {
  const { toast } = useToast();
  const [links, setLinks] = useState<VehicleLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);

  const load = () =>
    fetch(`/api/vehicles/${vehicleId}/links`)
      .then((r) => r.json())
      .then((d) => { setLinks(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));

  useEffect(() => { load(); }, [vehicleId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.url.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      const created = await res.json();
      setLinks((prev) => [created, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
      toast({ title: "Link saved" });
    } catch {
      toast({ title: "Failed to save link", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/vehicles/${vehicleId}/links/${id}`, { method: "DELETE" });
    setLinks((prev) => prev.filter((l) => l.id !== id));
    toast({ title: "Link removed" });
  };

  const startEdit = (link: VehicleLink) => {
    setEditingId(link.id);
    setEditForm({ title: link.title, url: link.url, description: link.description ?? "", category: link.category ?? "" });
  };

  const handleEditSave = async (id: string) => {
    const res = await fetch(`/api/vehicles/${vehicleId}/links/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (res.ok) {
      const updated = await res.json();
      setLinks((prev) => prev.map((l) => l.id === id ? updated : l));
      setEditingId(null);
      toast({ title: "Link updated" });
    }
  };

  // Group by category
  const grouped = links.reduce<Record<string, VehicleLink[]>>((acc, l) => {
    const key = l.category || "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(l);
    return acc;
  }, {});

  if (loading) return (
    <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
      <div className="w-4 h-4 border-2 border-theme border-t-transparent rounded-full animate-spin mr-2" /> Loading…
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Store forum threads, tutorials, part numbers, videos, and any other useful references for this build.</p>
        <Button onClick={() => setShowForm((s) => !s)} className="bg-theme hover:brightness-90 gap-2" size="sm">
          <Plus className="w-4 h-4" />
          Add Link
        </Button>
      </div>

      {/* Add form */}
      {showForm && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1">Title *</label>
                  <input
                    required
                    placeholder="ECS Tuning intake install guide"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">No category</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">URL *</label>
                <input
                  required
                  type="url"
                  placeholder="https://…"
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring font-mono text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Notes (optional)</label>
                <textarea
                  placeholder="What this link is about, part numbers, tips…"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>Cancel</Button>
                <Button type="submit" size="sm" className="bg-theme hover:brightness-90" disabled={saving}>
                  {saving ? "Saving…" : "Save Link"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {links.length === 0 && !showForm && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-14 text-center">
            <Link className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="font-medium mb-1">No saved links yet</p>
            <p className="text-sm text-muted-foreground mb-4">Save forum threads, install guides, spec sheets, YouTube videos — anything useful for this build.</p>
            <Button onClick={() => setShowForm(true)} size="sm" className="bg-theme hover:brightness-90">
              <Plus className="w-4 h-4 mr-1" /> Add First Link
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Link groups */}
      {Object.entries(grouped).map(([category, catLinks]) => (
        <div key={category}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${CATEGORY_COLORS[category] ?? CATEGORY_COLORS["Other"]}`}>
              {category}
            </span>
            <span className="text-xs text-muted-foreground">{catLinks.length}</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-2">
            {catLinks.map((link) => (
              <Card key={link.id} className="hover:border-border/60 transition-colors group">
                <CardContent className="p-3">
                  {editingId === link.id ? (
                    <div className="space-y-2">
                      <input
                        value={editForm.title}
                        onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                        className="w-full px-2 py-1 text-sm rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <input
                        value={editForm.url}
                        onChange={(e) => setEditForm((f) => ({ ...f, url: e.target.value }))}
                        className="w-full px-2 py-1 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                      />
                      <textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                        rows={2}
                        className="w-full px-2 py-1 text-sm rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                      />
                      <select
                        value={editForm.category}
                        onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                        className="w-full px-2 py-1 text-sm rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">No category</option>
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setEditingId(null)}>
                          <X className="w-3 h-3" /> Cancel
                        </Button>
                        <Button size="sm" className="h-7 gap-1 text-xs bg-theme hover:brightness-90" onClick={() => handleEditSave(link.id)}>
                          <Check className="w-3 h-3" /> Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-sm hover:text-theme transition-colors flex items-center gap-1.5"
                          >
                            {link.title}
                            <ExternalLink className="w-3 h-3 opacity-60 flex-shrink-0" />
                          </a>
                        </div>
                        {link.description && (
                          <p className="text-xs text-muted-foreground mt-1">{link.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground/50 mt-0.5 truncate font-mono">{link.url}</p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(link)}>
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:text-destructive" onClick={() => handleDelete(link.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
