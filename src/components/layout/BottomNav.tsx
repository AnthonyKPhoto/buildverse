"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Car, DollarSign, ShoppingBag, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/",         label: "Dashboard", icon: LayoutDashboard },
  { href: "/garage",   label: "Garage",    icon: Car             },
  { href: "/budget",   label: "Budget",    icon: DollarSign      },
  { href: "/products", label: "Products",  icon: ShoppingBag     },
  { href: "/settings", label: "Settings",  icon: Settings        },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border flex items-stretch"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
              active ? "text-theme" : "text-muted-foreground"
            )}
          >
            <Icon className={cn("w-5 h-5", active ? "text-theme" : "text-muted-foreground")} strokeWidth={active ? 2.2 : 1.8} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
