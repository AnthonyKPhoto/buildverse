"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Car, DollarSign, Wrench, FolderOpen, Bell,
  Plus, ArrowRight, ShoppingCart, Package, BarChart3, TrendingUp,
  Zap, Activity, ClipboardList,
} from "lucide-react";
import { formatCurrency, calcBuildCompletion } from "@/lib/utils";

type ActivityType = "mod" | "service" | "file" | "alert";
interface ActivityItem {
  type: ActivityType; id: string; text: string; sub: string;
  vehicleId: string | null; createdAt: string;
}
interface Vehicle {
  id: string; name?: string; year: number; make: string; model: string;
  trim?: string; photoUrl?: string;
  modifications: { id: string; status: string; price?: number | null }[];
  _count: { modifications: number; maintenanceLogs: number };
}

const QUICK_LINKS = [
  { href: "/budget",   icon: BarChart3,    label: "Budget",          desc: "Track spending by category" },
  { href: "/products", icon: ShoppingCart, label: "Product Tracker", desc: "Watch prices on parts" },
  { href: "/vendors",  icon: Package,      label: "Vendors",         desc: "Your trusted suppliers" },
  { href: "/garage",   icon: Car,          label: "Garage",          desc: "All vehicles & builds" },
];

const ACTIVITY_ICONS: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  mod: Wrench, service: ClipboardList, file: FolderOpen, alert: Bell,
};
const ACTIVITY_DOT: Record<ActivityType, string> = {
  mod: "bg-theme", service: "bg-blue-500", file: "bg-purple-500", alert: "bg-green-500",
};
const ACTIVITY_ICON_COLOR: Record<ActivityType, string> = {
  mod: "text-theme", service: "text-blue-400", file: "text-purple-400", alert: "text-green-400",
};

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = () =>
      Promise.all([
        fetch("/api/vehicles").then(r => r.json()),
        fetch("/api/activity").then(r => r.json()).catch(() => []),
      ]).then(([v, a]) => {
        setVehicles(Array.isArray(v) ? v : []);
        setActivity(Array.isArray(a) ? a : []);
        setLoading(false);
      }).catch(() => setLoading(false));

    fetchAll();
    const onFocus = () => fetchAll();
    window.addEventListener("focus", onFocus);
    const interval = setInterval(fetchAll, 30_000);
    return () => { window.removeEventListener("focus", onFocus); clearInterval(interval); };
  }, []);

  const totalMods      = vehicles.reduce((s, v) => s + v._count.modifications, 0);
  const totalInstalled = vehicles.reduce((s, v) => s + v.modifications.filter(m => m.status === "INSTALLED").length, 0);
  const totalInvested  = vehicles.reduce(
    (s, v) => s + v.modifications.filter(m => m.status === "INSTALLED").reduce((ms, m) => ms + (m.price ?? 0), 0), 0
  );

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-muted-foreground text-sm">
        <div className="w-4 h-4 border-2 border-theme border-t-transparent rounded-full animate-spin" />
        Loading…
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in space-y-8">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="-mx-3 -mt-4 md:-mx-6 md:-mt-8 px-3 md:px-6 pt-6 md:pt-8 pb-6 relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-theme/5 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-48 bg-theme/6 rounded-full blur-3xl -translate-y-12 translate-x-12 pointer-events-none" />

        <div className="relative">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs font-medium text-muted-foreground/50 tracking-widest uppercase mb-1">{today}</p>
              <h1 className="text-3xl font-bold tracking-tight">{timeGreeting()}</h1>
              {vehicles.length > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {vehicles.length} build{vehicles.length !== 1 ? "s" : ""} · {totalMods} mod{totalMods !== 1 ? "s" : ""} tracked
                </p>
              )}
            </div>
            <Link href="/garage">
              <Button size="sm" className="gap-2 bg-theme hover:brightness-90">
                <Plus className="w-4 h-4" /> Add Vehicle
              </Button>
            </Link>
          </div>

          {/* Stats strip */}
          {vehicles.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Vehicles",   value: vehicles.length.toString(),      icon: Car,        color: "text-theme",    stripe: "bg-theme/80" },
                { label: "Total Mods", value: totalMods.toString(),            icon: Wrench,     color: "text-blue-400", stripe: "bg-blue-400/70" },
                { label: "Installed",  value: totalInstalled.toString(),       icon: TrendingUp, color: "text-green-400",stripe: "bg-green-400/80" },
                { label: "Invested",   value: formatCurrency(totalInvested),   icon: DollarSign, color: "text-amber-400",stripe: "bg-amber-400/70" },
              ].map(({ label, value, icon: Icon, color, stripe }) => (
                <div key={label} className="relative flex items-center gap-3 bg-card border border-border/60 rounded-xl px-4 py-3 overflow-hidden">
                  <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${stripe}`} />
                  <Icon className={`w-5 h-5 shrink-0 ${color}`} />
                  <div>
                    <p className="text-xl font-bold leading-none tabular-nums">{value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Empty state ───────────────────────────────────────────────────────── */}
      {vehicles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-2xl bg-theme/10 ring-1 ring-theme/20 flex items-center justify-center mb-5">
            <Zap className="w-10 h-10 text-theme" />
          </div>
          <h2 className="text-xl font-bold mb-2">Your garage is empty</h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Add your first vehicle to start tracking mods, maintenance, and build progress.
          </p>
          <Link href="/garage">
            <Button className="bg-theme hover:brightness-90 gap-2">
              <Plus className="w-4 h-4" /> Add First Vehicle
            </Button>
          </Link>
        </div>
      )}

      {vehicles.length > 0 && (
        <>
          {/* ── Vehicle grid ─────────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-[3px] h-3.5 rounded-full bg-theme/50" />
                <h2 className="text-xs font-bold text-foreground/60 uppercase tracking-widest">My Garage</h2>
                <span className="text-xs font-semibold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                  {vehicles.length}
                </span>
              </div>
              <Link href="/garage">
                <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground h-7 px-2">
                  Manage <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {vehicles.map(v => <VehicleCard key={v.id} vehicle={v} />)}
            </div>
          </div>

          {/* ── Activity + Quick Links ────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ActivityTimeline items={activity} />
            </div>
            <div>
              <QuickLinks />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Vehicle card (used for every vehicle, uniform treatment) ───────────────────

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const [imgErr, setImgErr] = useState(false);
  const completion = calcBuildCompletion(vehicle.modifications);
  const installedValue = vehicle.modifications
    .filter(m => m.status === "INSTALLED")
    .reduce((s, m) => s + (m.price ?? 0), 0);

  const hasPhoto = vehicle.photoUrl && !imgErr;

  return (
    <Link href={`/garage/${vehicle.id}`} className="block group">
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/25 hover:border-theme/30 transition-all duration-200">
        {/* Photo / hero */}
        <div className="relative h-44 overflow-hidden bg-secondary">
          {hasPhoto ? (
            vehicle.photoUrl!.startsWith("data:") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={vehicle.photoUrl!}
                alt=""
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                onError={() => setImgErr(true)}
              />
            ) : (
              <Image
                src={vehicle.photoUrl!}
                alt=""
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                onError={() => setImgErr(true)}
              />
            )
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-secondary to-theme/8 flex flex-col items-center justify-center gap-2">
              <Car className="w-12 h-12 text-muted-foreground/15" />
              {vehicle.trim && (
                <span className="text-xs text-muted-foreground/30 font-medium">{vehicle.trim}</span>
              )}
            </div>
          )}
          {/* Bottom fade */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-card via-card/40 to-transparent" />
          {/* Completion badge */}
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold bg-black/50 backdrop-blur-sm text-white border border-white/10">
            {completion}%
          </div>
          {/* Name overlaid at bottom of photo */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
            <h3 className="font-bold text-base leading-tight truncate drop-shadow-sm">
              {vehicle.name || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}
            </h3>
            <p className="text-xs text-muted-foreground truncate">
              {vehicle.name
                ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
                : vehicle.trim || ""}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="px-4 pt-3 pb-4">
          <Progress value={completion} className="h-1.5 mb-4" />
          <div className="grid grid-cols-3 gap-2 mb-4 text-center">
            <div>
              <p className="text-[11px] text-muted-foreground leading-none mb-1">Mods</p>
              <p className="text-sm font-bold tabular-nums">{vehicle._count.modifications}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground leading-none mb-1">Invested</p>
              <p className="text-sm font-bold tabular-nums">{formatCurrency(installedValue)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground leading-none mb-1">Services</p>
              <p className="text-sm font-bold tabular-nums">{vehicle._count.maintenanceLogs}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-theme text-sm font-semibold group-hover:gap-3 transition-all duration-200">
            View Build <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Activity timeline ──────────────────────────────────────────────────────────

function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  const shown = items.slice(0, 8);

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-[3px] h-3.5 rounded-full bg-theme/50" />
        <h2 className="text-xs font-bold text-foreground/60 uppercase tracking-widest">Recent Activity</h2>
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-dashed border-border">
          <Activity className="w-7 h-7 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">No activity yet — add a mod or log a service.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
          {shown.map((item) => {
            const Icon = ACTIVITY_ICONS[item.type];
            const href = item.vehicleId ? `/garage/${item.vehicleId}` : "/products";
            return (
              <Link key={item.id} href={href}>
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors group">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${ACTIVITY_DOT[item.type]}/15`}>
                    <Icon className={`w-3 h-3 ${ACTIVITY_ICON_COLOR[item.type]}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.text}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.sub}</p>
                  </div>
                  <span className="text-xs text-muted-foreground/50 shrink-0">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Quick links ────────────────────────────────────────────────────────────────

function QuickLinks() {
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-[3px] h-3.5 rounded-full bg-theme/50" />
        <h2 className="text-xs font-bold text-foreground/60 uppercase tracking-widest">Quick Access</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {QUICK_LINKS.map(({ href, icon: Icon, label, desc }) => (
          <Link key={href} href={href}>
            <div className="flex flex-col gap-2 p-4 rounded-xl border border-border/60 bg-card hover:border-theme/30 hover:-translate-y-px hover:shadow-lg hover:shadow-black/20 transition-all duration-200 group h-full">
              <div className="w-8 h-8 rounded-lg bg-theme/10 flex items-center justify-center">
                <Icon className="w-4 h-4 text-theme" />
              </div>
              <div>
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground leading-snug mt-0.5">{desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
