"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Car, DollarSign,
  ShoppingBag, Settings, Store,
  ArrowUpCircle, Loader2, Search,
} from "lucide-react";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { AccountMenu } from "@/components/layout/AccountMenu";

type UpdateStatus =
  | { status: "idle" } | { status: "checking" } | { status: "current" }
  | { status: "available"; version: string; manual?: boolean; downloadUrl?: string }
  | { status: "downloading"; percent: number }
  | { status: "downloaded"; version: string }
  | { status: "error" };

const navItems = [
  { href: "/",         label: "Dashboard",       icon: LayoutDashboard, countKey: null },
  { href: "/garage",   label: "Garage",          icon: Car,             countKey: "vehicles" },
  { href: "/budget",   label: "Budget",          icon: DollarSign,      countKey: null },
  { href: "/products", label: "Product Tracker", icon: ShoppingBag,     countKey: null },
  { href: "/vendors",  label: "Vendors",         icon: Store,           countKey: null },
];

export function Sidebar() {
  const pathname = usePathname();
  const { toast } = useToast();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [update, setUpdate] = useState<UpdateStatus>({ status: "idle" });
  const [searchOpen, setSearchOpen] = useState(false);
  const toastedRef = useRef<Set<string>>(new Set());

  // Cmd+K / Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    fetch("/api/vehicles").then((r) => r.json()).then((vehicles) => {
      setCounts({
        vehicles: Array.isArray(vehicles) ? vehicles.length : 0,
      });
    }).catch(() => {});
  }, []);

  // Auto-sync LubeLogger silently if the configured interval has elapsed
  useEffect(() => {
    const INTERVALS: Record<string, number> = {
      hourly: 3_600_000,
      daily:  86_400_000,
      weekly: 604_800_000,
    };
    fetch("/api/integrations/lubelogger/config")
      .then((r) => r.json())
      .then((cfg) => {
        const ms = INTERVALS[cfg.syncInterval];
        if (!ms || !cfg.url) return;
        const elapsed = cfg.lastSync ? Date.now() - new Date(cfg.lastSync).getTime() : Infinity;
        if (elapsed >= ms) {
          fetch("/api/integrations/lubelogger/sync", { method: "POST" }).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  // Fire price-alert toasts once per session on launch
  useEffect(() => {
    const key = "bv-price-alerts-toasted";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    fetch("/api/products/alerts")
      .then((r) => r.json())
      .then((alerts: { id: string; title: string; currentPrice: number; alertThreshold: number }[]) => {
        if (!Array.isArray(alerts) || alerts.length === 0) return;
        if (alerts.length === 1) {
          toast({
            title: "Price alert — target reached!",
            description: `${alerts[0].title} is now $${alerts[0].currentPrice?.toFixed(2)}`,
            duration: 8000,
          });
        } else {
          toast({
            title: `${alerts.length} price alerts triggered`,
            description: alerts.map((a) => a.title).join(", "),
            duration: 10000,
          });
        }
      })
      .catch(() => {});
  }, [toast]);

  useEffect(() => {
    const api = (window as Window & { electronAPI?: { update: { onStatus: (cb: (s: UpdateStatus) => void) => () => void; install: () => void } } }).electronAPI;
    if (!api?.update?.onStatus) return;

    const cleanup = api.update.onStatus((info) => {
      setUpdate(info);

      // Toast once per version event to avoid re-toasting on re-render
      const key = info.status + ("version" in info ? info.version : "");
      if (toastedRef.current.has(key)) return;
      toastedRef.current.add(key);

      if (info.status === "available") {
        toast({
          title: `Update v${info.version} available`,
          description: info.manual
            ? "Visit GitHub to download the latest release."
            : "Downloading in the background…",
        });
      } else if (info.status === "downloaded") {
        toast({
          title: `BuildVerse v${info.version} ready`,
          description: "Click 'Restart to install' in the sidebar.",
          duration: 8000,
        });
      }
    });

    return cleanup;
  }, [toast]);

  const downloading = update.status === "downloading";
  const downloaded  = update.status === "downloaded";

  return (
    <>
    <aside
      className="hidden md:flex flex-shrink-0 flex-col border-r border-border bg-card"
      style={{ width: "var(--sidebar-width, 240px)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-border shrink-0">
        <Image src="/logo.svg" alt="BuildVerse" width={34} height={34} className="rounded-xl shrink-0" />
        <div className="leading-none">
          <p className="font-semibold text-sm tracking-tight">
            Build<span className="text-theme">Verse</span>
          </p>
          <p className="text-2xs text-muted-foreground mt-0.5">Mod Manager</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-hide">
        <p className="px-3 mb-2 text-2xs font-semibold text-muted-foreground uppercase tracking-widest">
          Menu
        </p>

        {/* Global search */}
        <button
          onClick={() => setSearchOpen(true)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-150 mb-1"
        >
          <Search className="w-[18px] h-[18px] shrink-0 text-muted-foreground" strokeWidth={1.8} />
          Search
          <kbd className="ml-auto text-2xs text-muted-foreground/40 border border-border rounded px-1 py-0.5 font-sans">
            ⌘K
          </kbd>
        </button>

        {navItems.map(({ href, label, icon: Icon, countKey }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          const count = countKey ? counts[countKey] : undefined;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                active
                  ? "bg-theme/12 text-theme"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <Icon
                className={cn(
                  "w-[18px] h-[18px] shrink-0 transition-colors",
                  active ? "text-theme" : "text-muted-foreground group-hover:text-foreground"
                )}
                strokeWidth={active ? 2.2 : 1.8}
              />
              {label}
              <span className="ml-auto flex items-center gap-1.5">
                {count != null && count > 0 && (
                  <span className={cn(
                    "text-2xs font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                    active
                      ? "bg-theme/20 text-theme"
                      : "bg-secondary text-muted-foreground group-hover:bg-secondary/80"
                  )}>
                    {count}
                  </span>
                )}
                {active && <span className="w-1.5 h-1.5 rounded-full bg-theme" />}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-border shrink-0 space-y-1.5">

        {/* Downloading progress bar */}
        {downloading && (
          <div className="px-3 py-2.5 rounded-xl bg-secondary/60 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="w-3.5 h-3.5 text-theme animate-spin flex-shrink-0" />
              <span className="text-2xs font-medium">
                Downloading update… {(update as { percent: number }).percent}%
              </span>
            </div>
            <div className="w-full bg-border/60 rounded-full h-1">
              <div
                className="bg-theme h-1 rounded-full transition-all duration-500"
                style={{ width: `${(update as { percent: number }).percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Manual update available badge */}
        {update.status === "available" && update.manual && (
          <div className="px-3 py-2.5 rounded-xl bg-theme/8 border border-theme/25">
            <div className="flex items-center gap-2 mb-1.5">
              <ArrowUpCircle className="w-3.5 h-3.5 text-theme flex-shrink-0" />
              <span className="text-2xs font-semibold text-theme">v{update.version} available</span>
            </div>
            <button
              onClick={() => window.open(update.downloadUrl ?? "https://github.com/AnthonyKPhoto/buildverse/releases/latest", "_blank")}
              className="block w-full text-center text-2xs font-semibold text-white bg-theme hover:brightness-90 rounded-lg py-1.5 transition-all"
            >
              Download on GitHub →
            </button>
          </div>
        )}

        {/* Update ready badge */}
        {downloaded && (
          <div className="px-3 py-2.5 rounded-xl bg-green-500/8 border border-green-500/25">
            <div className="flex items-center gap-2 mb-1.5">
              <ArrowUpCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
              <span className="text-2xs font-semibold text-green-400">
                v{(update as { version: string }).version} ready to install
              </span>
            </div>
            <button
              onClick={() => (window as Window & { electronAPI?: { update: { install: () => void } } }).electronAPI?.update.install()}
              className="w-full text-2xs font-semibold text-green-900 bg-green-400 hover:bg-green-300 rounded-lg py-1.5 transition-colors"
            >
              Restart to install →
            </button>
          </div>
        )}

        <Link
          href="/settings"
          className={cn(
            "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
            pathname === "/settings"
              ? "bg-theme/12 text-theme"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          )}
        >
          <Settings
            className={cn(
              "w-[18px] h-[18px] shrink-0",
              pathname === "/settings" ? "text-theme" : "text-muted-foreground group-hover:text-foreground"
            )}
            strokeWidth={pathname === "/settings" ? 2.2 : 1.8}
          />
          Settings
          {pathname === "/settings" && (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-theme" />
          )}
        </Link>
        {/* Renders nothing in local/Electron mode — server mode only */}
        <AccountMenu className="px-3 py-2 mt-1 border-t border-border/60 pt-2.5" />
        <p className="text-2xs text-muted-foreground/50 px-3 pt-1 pb-0.5">
          BuildVerse
        </p>
      </div>
    </aside>
    <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
