"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Pin, Star, Check, X } from "lucide-react";

interface VehicleNote {
  id: string;
  vehicleId: string;
  title: string;
  content: string;
  color: string;
  importance: number;
  createdAt: string;
  updatedAt: string;
}

// Inline styles avoid Tailwind purge issues with dynamic class names
const NOTE_COLORS: Record<string, { hex: string; bg: string; dot: string }> = {
  yellow: { hex: "#fbbf24", bg: "rgba(251,191,36,0.07)",  dot: "bg-yellow-400" },
  blue:   { hex: "#60a5fa", bg: "rgba(96,165,250,0.07)",  dot: "bg-blue-400"   },
  green:  { hex: "#4ade80", bg: "rgba(74,222,128,0.07)",  dot: "bg-green-400"  },
  red:    { hex: "#f87171", bg: "rgba(248,113,113,0.07)", dot: "bg-red-400"    },
  purple: { hex: "#c084fc", bg: "rgba(192,132,252,0.07)", dot: "bg-purple-400" },
  orange: { hex: "#fb923c", bg: "rgba(251,146,60,0.07)",  dot: "bg-orange-400" },
};
const COLOR_KEYS = Object.keys(NOTE_COLORS);

function NoteCard({
  note,
  isNew,
  onUpdate,
  onDelete,
  onSave,
}: {
  note: VehicleNote;
  isNew: boolean;
  onUpdate: (id: string, changes: Partial<VehicleNote>) => void;
  onDelete: (id: string) => void;
  onSave: (id: string, title: string, content: string) => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const prevId = useRef(note.id);

  // Reset local state if React reuses this instance for a different note
  useEffect(() => {
    if (prevId.current !== note.id) {
      prevId.current = note.id;
      setTitle(note.title);
      setContent(note.content);
      setConfirmDiscard(false);
    }
  }, [note.id, note.title, note.content]);

  const isDirty = title !== note.title || content !== note.content;
  const showActions = isDirty || isNew;
  const colors = NOTE_COLORS[note.color] ?? NOTE_COLORS.yellow;

  const handleSave = () => {
    onSave(note.id, title, content);
    setConfirmDiscard(false);
  };

  const handleDiscardClick = () => {
    if (isNew && !isDirty) {
      onDelete(note.id);
    } else {
      setConfirmDiscard(true);
    }
  };

  const handleConfirmDiscard = () => {
    if (isNew) {
      onDelete(note.id);
    } else {
      setTitle(note.title);
      setContent(note.content);
      setConfirmDiscard(false);
    }
  };

  return (
    <div
      className="group relative flex flex-col gap-3 rounded-xl border border-border/60 border-l-[3px] p-4 min-h-[200px] transition-colors"
      style={{ borderLeftColor: colors.hex, backgroundColor: colors.bg }}
    >
      {/* Color picker + delete */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {COLOR_KEYS.map((c) => (
            <button
              key={c}
              title={c}
              className={`w-2.5 h-2.5 rounded-full transition-transform hover:scale-125 ${NOTE_COLORS[c].dot} ${
                note.color === c ? "ring-2 ring-offset-1 ring-offset-background ring-white/30 scale-110" : ""
              }`}
              onClick={() => onUpdate(note.id, { color: c })}
            />
          ))}
        </div>
        {!showActions && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
            onClick={() => onDelete(note.id)}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>

      {/* Title */}
      <input
        className="bg-transparent font-semibold text-sm placeholder:text-muted-foreground/40 focus:outline-none w-full"
        placeholder="Note title…"
        autoComplete="off"
        value={title}
        onChange={(e) => { setTitle(e.target.value); setConfirmDiscard(false); }}
      />

      {/* Content */}
      <textarea
        className="bg-transparent text-sm text-muted-foreground/80 placeholder:text-muted-foreground/40 focus:outline-none resize-none flex-1 min-h-[80px] leading-relaxed"
        placeholder="Write something…"
        value={content}
        onChange={(e) => { setContent(e.target.value); setConfirmDiscard(false); }}
      />

      {/* Priority stars */}
      <div className="flex items-center gap-0.5 border-t border-border/30 pt-2">
        <span className="text-xs text-muted-foreground/50 mr-1.5">Priority</span>
        {[1, 2, 3].map((star) => (
          <button
            key={star}
            onClick={() => onUpdate(note.id, { importance: note.importance === star ? 0 : star })}
            className="p-0.5 rounded transition-transform hover:scale-110"
            title={star === 1 ? "Low" : star === 2 ? "Medium" : "High"}
          >
            <Star
              className={`w-3.5 h-3.5 transition-colors ${
                star <= note.importance
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/30 hover:text-amber-400/60"
              }`}
            />
          </button>
        ))}
        {note.importance > 0 && (
          <span className="text-xs ml-1.5 text-amber-400/70">
            {note.importance === 1 ? "Low" : note.importance === 2 ? "Medium" : "High"}
          </span>
        )}
      </div>

      {/* Save / Discard */}
      {showActions && !confirmDiscard && (
        <div className="flex gap-2 border-t border-border/30 pt-2">
          <Button size="sm" className="flex-1 h-7 bg-theme hover:brightness-90 text-xs gap-1" onClick={handleSave}>
            <Check className="w-3 h-3" /> Save
          </Button>
          <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1" onClick={handleDiscardClick}>
            <X className="w-3 h-3" /> {isNew ? "Delete" : "Discard"}
          </Button>
        </div>
      )}

      {/* Inline discard confirmation */}
      {confirmDiscard && (
        <div className="flex flex-col gap-2 border-t border-border/30 pt-2">
          <p className="text-xs text-muted-foreground text-center">
            {isNew ? "Delete this note?" : "Discard unsaved changes?"}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" className="flex-1 h-7 text-xs" onClick={handleConfirmDiscard}>
              {isNew ? "Delete" : "Discard"}
            </Button>
            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => setConfirmDiscard(false)}>
              Keep editing
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function NoteBoard({ vehicleId }: { vehicleId: string }) {
  const [notes, setNotes] = useState<VehicleNote[]>([]);
  const [newNoteIds, setNewNoteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/vehicles/${vehicleId}/notes`)
      .then((r) => r.json())
      .then((d) => { setNotes(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [vehicleId]);

  const addNote = async () => {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "", content: "", color: "yellow", importance: 0 }),
      });
      const note = await res.json();
      if (!note?.id) return; // guard against error responses
      setNotes((prev) => [note, ...prev]);
      setNewNoteIds((prev) => { const next = new Set(prev); next.add(note.id); return next; });
    } catch {}
  };

  const updateNote = async (noteId: string, changes: Partial<VehicleNote>) => {
    setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, ...changes } : n)));
    await fetch(`/api/vehicles/${vehicleId}/notes/${noteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    }).catch(() => {});
  };

  const saveNote = async (noteId: string, title: string, content: string) => {
    setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, title, content } : n)));
    setNewNoteIds((prev) => { const next = new Set(prev); next.delete(noteId); return next; });
    await fetch(`/api/vehicles/${vehicleId}/notes/${noteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    }).catch(() => {});
  };

  const deleteNote = async (noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    setNewNoteIds((prev) => { const next = new Set(prev); next.delete(noteId); return next; });
    await fetch(`/api/vehicles/${vehicleId}/notes/${noteId}`, { method: "DELETE" }).catch(() => {});
  };

  const sorted = [...notes].sort((a, b) => b.importance - a.importance);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Build Notes</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {notes.length} note{notes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={addNote} size="sm" className="bg-theme hover:brightness-90 gap-2">
          <Plus className="w-4 h-4" />
          Add Note
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm py-10">
          <div className="w-4 h-4 border-2 border-theme border-t-transparent rounded-full animate-spin" />
          Loading…
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-border">
          <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 flex items-center justify-center mb-4">
            <Pin className="w-7 h-7 text-yellow-400" />
          </div>
          <p className="font-semibold mb-1">No notes yet</p>
          <p className="text-sm text-muted-foreground mb-5">Pin thoughts, plans, and ideas to your build</p>
          <Button onClick={addNote} size="sm" className="bg-theme hover:brightness-90 gap-2">
            <Plus className="w-4 h-4" /> Add First Note
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              isNew={newNoteIds.has(note.id)}
              onUpdate={updateNote}
              onDelete={deleteNote}
              onSave={saveNote}
            />
          ))}
        </div>
      )}
    </div>
  );
}
