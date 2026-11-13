"use client";

import { useState } from "react";
import { Percent, DollarSign, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Mode = "pct" | "fixed" | "clear";
type EmailChoice = "keep" | "on" | "off";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  applying: boolean;
  onApply: (body: { mode: Mode; value?: number; notifyEmail?: boolean }) => void;
}

export function BulkAlertDialog({ open, onOpenChange, count, applying, onApply }: Props) {
  const [mode, setMode] = useState<Mode>("pct");
  const [value, setValue] = useState("");
  const [email, setEmail] = useState<EmailChoice>("keep");

  const num = parseFloat(value);
  const valid = mode === "clear" || (!isNaN(num) && num >= 0 && (mode !== "pct" || num <= 100));

  const submit = () => {
    if (!valid) return;
    onApply({
      mode,
      ...(mode !== "clear" ? { value: num } : {}),
      ...(email !== "keep" ? { notifyEmail: email === "on" } : {}),
    });
  };

  const tab = (m: Mode, label: string, Icon: React.ElementType) => (
    <button
      onClick={() => setMode(m)}
      className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium border rounded-xl transition-all",
        mode === m ? "border-theme bg-theme/10 text-theme" : "border-border bg-secondary text-muted-foreground hover:text-foreground")}
    >
      <Icon className="w-3.5 h-3.5" />{label}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Set alerts for all {count} product{count === 1 ? "" : "s"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            {tab("pct", "% off now", Percent)}
            {tab("fixed", "Fixed price", DollarSign)}
            {tab("clear", "Clear all", BellOff)}
          </div>

          {mode !== "clear" ? (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                {mode === "pct" ? "Alert when a price drops by" : "Alert when a price is at or below"}
              </label>
              <div className="relative mt-2 w-40">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">{mode === "pct" ? "%" : "$"}</span>
                <input
                  type="number" min="0" max={mode === "pct" ? 100 : undefined} step="0.01" autoFocus
                  placeholder={mode === "pct" ? "10" : "0.00"} value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                  className="w-full pl-7 pr-2 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring tabular-nums"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {mode === "pct"
                  ? "Each product's target becomes its current price minus this percentage. Products with no known price are skipped."
                  : "Every product gets this same target price. This replaces any alerts you've already set."}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Removes the target price from every product.</p>
          )}

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Email</label>
            <div className="flex gap-2 mt-2">
              {([["keep", "Leave as is"], ["on", "Email for all"], ["off", "Email for none"]] as const).map(([id, label]) => (
                <button key={id} onClick={() => setEmail(id)}
                  className={cn("flex-1 py-1.5 text-xs font-medium border rounded-lg transition-all",
                    email === id ? "border-theme bg-theme/10 text-theme" : "border-border bg-secondary text-muted-foreground hover:text-foreground")}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-theme hover:brightness-90" disabled={!valid || applying} onClick={submit}>
            {applying ? "Applying…" : mode === "clear" ? "Clear alerts" : "Apply to all"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
