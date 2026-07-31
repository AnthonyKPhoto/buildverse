"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface CurrentUser { id: string; username: string; role: "admin" | "member"; }

// Renders nothing in local/Electron mode or when nobody's signed in (e.g. the
// loopback bypass) — same gating as Settings → Access & Sync → Account.
export function AccountMenu({ className }: { className?: string }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [mode, setMode] = useState<"local" | "server" | null>(null);

  useEffect(() => {
    fetch("/api/health").then(r => r.json()).then(h => setMode(h.mode)).catch(() => {});
    fetch("/api/auth/me").then(r => r.json()).then(({ user }) => setUser(user)).catch(() => {});
  }, []);

  if (mode !== "server" || !user) return null;

  const signOut = async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); }
    finally { window.location.href = "/login"; }
  };

  return (
    <div className={cn("flex items-center gap-2 min-w-0", className)}>
      <span className="text-sm font-medium truncate">{user.username}</span>
      <span className={cn(
        "text-2xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0",
        user.role === "admin" ? "bg-theme/15 text-theme" : "bg-secondary text-muted-foreground"
      )}>
        {user.role}
      </span>
      <button
        onClick={signOut}
        title="Sign out"
        className="ml-auto shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
}
