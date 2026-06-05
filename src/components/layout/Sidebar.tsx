"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Car, Wrench, DollarSign, ShoppingCart, Settings,
  Gauge, Package, ClipboardList, Zap,
} from "lucide-react";

const navItems = [
  { href: "/",            label: "Dashboard",      icon: Gauge },
  { href: "/garage",      label: "Garage",         icon: Car },
  { href: "/builds",      label: "Build Plans",    icon: Wrench },
  { href: "/budget",      label: "Budget",         icon: DollarSign },
  { href: "/products",    label: "Product Tracker",icon: ShoppingCart },
  { href: "/maintenance", label: "Maintenance",    icon: ClipboardList },
  { href: "/vendors",     label: "Vendors",        icon: Package },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col bg-card border-r border-border">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center">
          <Zap className="w-4 h-4 text-theme" />
        </div>
        <span className="text-base font-semibold tracking-tight">
          Build<span className="text-theme">Verse</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pb-2 space-y-0.5 overflow-y-auto">
        <p className="px-3 pt-1 pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Navigation
        </p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-100",
                active
                  ? "bg-secondary text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 pt-2 border-t border-border">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-100",
            pathname === "/settings"
              ? "bg-secondary text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          )}
        >
          <Settings className="w-4 h-4" />
          Settings
        </Link>
        <p className="text-[11px] text-muted-foreground/60 px-3 mt-3">BuildVerse v1.0.0</p>
      </div>
    </aside>
  );
}
