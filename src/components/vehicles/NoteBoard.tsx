"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Pin, Star } from "lucide-react";

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

const NOTE_COLORS = {
  yellow: { bg: "bg-yellow-500/8",  borderLeft: "border-l-yellow-400",  dot: "bg-yellow-400"  },
  blue:   { bg: "bg-blue-500/8",    borderLeft: "border-l-blue-400",    dot: "bg-blue-400"    },
  green:  { bg: "bg-green-500/8",   borderLeft: "border-l-green-400",   dot: "bg-green-400"   },
  red:    { bg: "bg-red-500/8",     borderLeft: "border-l-red-400",     dot: "bg-red-400"     },
  purple: { bg: "bg-purple-500/8",  borderLeft: "border-l-purple-400",  dot: "bg-purple-400"  },
  orange: { bg: "bg-orange-500/8",  borderLeft: "border-l-orange-400",  dot: "bg-orange-400"  },
} as const;
type NoteColor = keyof typeof NOTE_COLORS;
const COLOR_KEYS = Object.keys(NOTE_COLORS) as NoteColor[];

function NoteCard({
  note,
  onUpdate,
  onDelete,
}: {
  note: VehicleNote;
  onUpdate: (id: string, changes: Partial<VehicleNote>) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);

  const colors = NOTE_COLORS[note.color as NoteColor] ?? NOTE_COLORS.yellow;

  const setImportance = (val: number) => {
    // clicking the same star again clears importance
    onUpdate(note.id, { importance: note.importance === val ? 0 : val });
  };

  return (
    <div
      className={`group relative flex flex-col gap-3 rounded-xl border border-border/60 border-l-[3px] ${colors.borderLeft} ${colors.bg} p-4 min-h-[180px]`}
    >
      {/* Top row: color picker + delete */}
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
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
          onClick={() => onDelete(note.id)}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      {/* Title */}
      <input
        className="bg-transparent font-semibold text-sm placeholder:text-muted-foreground/40 focus:outline-none w-full"
        placeholder="Note title…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => { if (title !== note.title) onUpdate(note.id, { title }); }}
      />

      {/* Content */}
      <textarea
        className="bg-transparent text-sm text-muted-foreground/80 placeholder:text-muted-foreground/40 focus:outline-none resize-none flex-1 min-h-[80px] leading-relaxed"
        placeholder="Write something…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={() => { if (content !== note.content) onUpdate(note.id, { content }); }}
      />

      {/* Bottom: importance stars */}
      <div className="flex items-center gap-0.5 pt-1 border-t border-border/30">
        <span className="text-xs text-muted-foreground/50 mr-1.5">Priority</span>
        {[1, 2, 3].map((star) => (
          <button
            key={star}
            onClick={() => setImportance(star)}
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
    </div>
  );
}

export function NoteBoard({ vehicleId }: { vehicleId: string }) {
  const [notes, setNotes] = useState<VehicleNote[]>([]);
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
      setNotes((prev) => [note, ...prev]);
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

  const deleteNote = async (noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    await fetch(`/api/vehicles/${vehicleId}/notes/${noteId}`, { method: "DELETE" }).catch(() => {});
  };

  // Sort: higher importance first, then by creation order
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
            <NoteCard key={note.id} note={note} onUpdate={updateNote} onDelete={deleteNote} />
          ))}
        </div>
      )}
    </div>
  );
}
