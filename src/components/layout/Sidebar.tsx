"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Car, Wrench, DollarSign,
  ShoppingBag, Settings, ClipboardList, Store,
} from "lucide-react";
import Image from "next/image";

const navItems = [
  { href: "/",            label: "Dashboard",       icon: LayoutDashboard },
  { href: "/garage",      label: "Garage",          icon: Car },
  { href: "/builds",      label: "Build Plans",     icon: Wrench },
  { href: "/budget",      label: "Budget",          icon: DollarSign },
  { href: "/products",    label: "Product Tracker", icon: ShoppingBag },
  { href: "/maintenance", label: "Maintenance",     icon: ClipboardList },
  { href: "/vendors",     label: "Vendors",         icon: Store },
];

export function Sidebar() {
  const pathname = usePathname();

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

        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
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
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-theme" />
              )}
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
          BuildVerse v1.0.0
        </p>
      </div>
    </aside>
  );
}
