"use client";

import { useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDroppable, useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { GripVertical } from "lucide-react";

interface Modification {
  id: string;
  name: string;
  category: string;
  status: string;
  priority: string;
  price?: number | null;
  actualPrice?: number | null;
  brand?: string;
  imageUrl?: string;
}

interface Props {
  mods: Modification[];
  onStatusChange: (modId: string, newStatus: string) => void;
}

const COLUMNS: { status: string; label: string; color: string }[] = [
  { status: "PLANNED",     label: "Planned",     color: "bg-slate-500/15 text-slate-400 border-slate-500/20" },
  { status: "RESEARCHING", label: "Researching", color: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  { status: "ORDERED",     label: "Ordered",     color: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  { status: "PURCHASED",   label: "Purchased",   color: "bg-purple-500/15 text-purple-400 border-purple-500/20" },
  { status: "INSTALLED",   label: "Installed",   color: "bg-green-500/15 text-green-400 border-green-500/20" },
];

const PRIORITY_DOT: Record<string, string> = {
  CRITICAL: "bg-red-500",
  HIGH:     "bg-orange-500",
  MEDIUM:   "bg-yellow-500",
  LOW:      "bg-blue-500",
  NONE:     "bg-transparent",
};

// ── Draggable mod card ────────────────────────────────────────────────────────

function ModCard({ mod, overlay = false }: { mod: Modification; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: mod.id });
  const style = { transform: CSS.Translate.toString(transform) };

  if (overlay) {
    return (
      <div className="rounded-xl border border-theme/40 bg-card shadow-2xl p-3 w-full opacity-95">
        <p className="text-xs font-semibold line-clamp-2">{mod.name}</p>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group rounded-xl border border-border bg-card p-3 space-y-1.5 cursor-grab active:cursor-grabbing transition-shadow ${
        isDragging ? "opacity-40 shadow-none" : "hover:shadow-md hover:border-border/60"
      }`}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start gap-1.5">
        {mod.priority !== "NONE" && (
          <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[mod.priority] ?? ""}`} />
        )}
        <p className="text-xs font-semibold leading-snug line-clamp-2 flex-1">{mod.name}</p>
        <GripVertical className="w-3 h-3 text-muted-foreground/40 shrink-0 mt-0.5 group-hover:text-muted-foreground/70 transition-colors" />
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge variant="secondary" className="text-2xs px-1.5 py-0">{mod.category}</Badge>
        {mod.brand && <span className="text-2xs text-muted-foreground truncate max-w-[80px]">{mod.brand}</span>}
      </div>
      {(mod.actualPrice ?? mod.price) != null && (
        <p className="text-2xs font-medium text-theme">{formatCurrency((mod.actualPrice ?? mod.price)!)}</p>
      )}
    </div>
  );
}

// ── Droppable column ──────────────────────────────────────────────────────────

function Column({
  status, label, color, mods,
}: { status: string; label: string; color: string; mods: Modification[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex flex-col min-w-[200px] flex-1">
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl border border-b-0 border-border ${isOver ? "bg-theme/8 border-theme/30" : "bg-secondary/30"} transition-colors`}>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${color}`}>{label}</span>
        </div>
        <span className="text-xs text-muted-foreground font-medium">{mods.length}</span>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[200px] p-2 space-y-2 rounded-b-xl border border-border transition-colors ${isOver ? "bg-theme/5 border-theme/20" : "bg-secondary/10"}`}
      >
        {mods.map((mod) => <ModCard key={mod.id} mod={mod} />)}
        {mods.length === 0 && (
          <div className="flex items-center justify-center h-20 text-2xs text-muted-foreground/40 select-none">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function KanbanView({ mods, onStatusChange }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeMod = activeId ? mods.find((m) => m.id === activeId) : null;

  const modsByStatus = COLUMNS.reduce<Record<string, Modification[]>>((acc, col) => {
    acc[col.status] = mods.filter((m) => m.status === col.status);
    return acc;
  }, {});

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const targetStatus = String(over.id);
    if (!COLUMNS.find((c) => c.status === targetStatus)) return;
    const mod = mods.find((m) => m.id === active.id);
    if (mod && mod.status !== targetStatus) {
      onStatusChange(String(active.id), targetStatus);
    }
  };

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <Column key={col.status} {...col} mods={modsByStatus[col.status] ?? []} />
        ))}
      </div>
      <DragOverlay>
        {activeMod ? <ModCard mod={activeMod} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
