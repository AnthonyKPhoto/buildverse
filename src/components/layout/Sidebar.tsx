"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Car, DollarSign,
  ShoppingBag, Settings, ClipboardList, Store,
} from "lucide-react";
import Image from "next/image";

const navItems = [
  { href: "/",            label: "Dashboard",       icon: LayoutDashboard, countKey: null },
  { href: "/garage",      label: "Garage",          icon: Car,             countKey: "vehicles" },
  { href: "/budget",      label: "Budget",          icon: DollarSign,      countKey: null },
  { href: "/products",    label: "Product Tracker", icon: ShoppingBag,     countKey: null },
  { href: "/maintenance", label: "Maintenance",     icon: ClipboardList,   countKey: "maintenance" },
  { href: "/vendors",     label: "Vendors",         icon: Store,           countKey: null },
];

export function Sidebar() {
  const pathname = usePathname();
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    Promise.allSettled([
      fetch("/api/vehicles").then((r) => r.json()),
      fetch("/api/maintenance").then((r) => r.json()),
    ]).then(([vehicles, maintenance]) => {
      setCounts({
        vehicles: Array.isArray(vehicles.value) ? vehicles.value.length : 0,
        maintenance: Array.isArray(maintenance.value) ? maintenance.value.length : 0,
      });
    });
  }, []);

  return (
    <aside
      className="flex-shrink-0 flex flex-col border-r border-border bg-card"
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
      <div className="px-3 py-3 border-t border-border shrink-0 space-y-0.5">
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
        <p className="text-2xs text-muted-foreground/50 px-3 pt-1.5 pb-1">
          BuildVerse
        </p>
      </div>
    </aside>
  );
}
