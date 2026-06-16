"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Car, DollarSign, Wrench, ClipboardList, FolderOpen, Bell,
  Plus, ArrowRight, ShoppingCart, Package, BarChart3, TrendingUp,
  Zap, Settings2, Eye, EyeOff, Activity,
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

type SectionKey = "spotlight" | "activity" | "garage" | "links";

const SECTION_LABELS: Record<SectionKey, string> = {
  spotlight: "Vehicle Spotlight",
  activity: "Recent Activity",
  garage: "All Vehicles",
  links: "Quick Links",
};

const QUICK_LINKS = [
  { href: "/budget",      icon: BarChart3,    label: "Budget" },
  { href: "/products",    icon: ShoppingCart, label: "Products" },
  { href: "/maintenance", icon: ClipboardList, label: "Maintenance" },
  { href: "/vendors",     icon: Package,       label: "Vendors" },
  { href: "/garage",      icon: Car,           label: "Garage" },
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

const DEFAULT_VIS: Record<SectionKey, boolean> = { spotlight: true, activity: true, garage: true, links: true };

function loadVis(): Record<SectionKey, boolean> {
  if (typeof window === "undefined") return DEFAULT_VIS;
  try {
    const s = localStorage.getItem("bv-dash-sections");
    if (s) return { ...DEFAULT_VIS, ...JSON.parse(s) };
  } catch {}
  return DEFAULT_VIS;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [customizing, setCustomizing] = useState(false);
  const [visible, setVisible] = useState<Record<SectionKey, boolean>>(DEFAULT_VIS);

  useEffect(() => { setVisible(loadVis()); }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/vehicles").then(r => r.json()),
      fetch("/api/activity").then(r => r.json()).catch(() => []),
    ]).then(([v, a]) => {
      setVehicles(Array.isArray(v) ? v : []);
      setActivity(Array.isArray(a) ? a : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const toggleSection = (key: SectionKey) => {
    setVisible(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem("bv-dash-sections", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const stats = {
    vehicleCount: vehicles.length,
    modCount: vehicles.reduce((s, v) => s + v._count.modifications, 0),
    installedCount: vehicles.reduce((s, v) => s + v.modifications.filter(m => m.status === "INSTALLED").length, 0),
    totalInstalled: vehicles.reduce(
      (s, v) => s + v.modifications.filter(m => m.status === "INSTALLED").reduce((ms, m) => ms + (m.price ?? 0), 0), 0
    ),
  };

  const spotlights = vehicles.slice(0, 2);
  const restVehicles = vehicles.slice(2);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-muted-foreground text-sm">
        <div className="w-4 h-4 border-2 border-theme border-t-transparent rounded-full animate-spin" />
        Loading…
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in">
      {/* ── Hero banner ──────────────────────────────────────────────────────── */}
      <div className="-mx-6 -mt-8 mb-8 px-6 pt-8 pb-6 border-b border-border/60 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-theme/5 pointer-events-none" />
        <div className="absolute top-0 right-0 w-80 h-40 bg-theme/8 rounded-full blur-3xl -translate-y-10 translate-x-10 pointer-events-none" />
        <div className="relative">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs font-medium text-muted-foreground/60 tracking-wider uppercase mb-1">{today}</p>
              <h1 className="text-3xl font-bold tracking-tight">{timeGreeting()}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {vehicles.length > 0
                  ? `${stats.vehicleCount} build${stats.vehicleCount !== 1 ? "s" : ""} · ${stats.modCount} mod${stats.modCount !== 1 ? "s" : ""} tracked`
                  : "Start tracking your first build"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost" size="sm"
                className="gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={() => setCustomizing(c => !c)}
              >
                <Settings2 className="w-4 h-4" />
                {customizing ? "Done" : "Customize"}
              </Button>
              <Link href="/garage">
                <Button size="sm" className="gap-2 bg-theme hover:brightness-90">
                  <Plus className="w-4 h-4" /> Add Vehicle
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Vehicles",   value: stats.vehicleCount.toString(),        icon: Car,        color: "text-theme",    bg: "bg-theme/10" },
              { label: "Total Mods", value: stats.modCount.toString(),            icon: Wrench,     color: "text-blue-400", bg: "bg-blue-500/10" },
              { label: "Installed",  value: stats.installedCount.toString(),      icon: TrendingUp, color: "text-green-400",bg: "bg-green-500/10" },
              { label: "Invested",   value: formatCurrency(stats.totalInstalled), icon: DollarSign, color: "text-amber-400",bg: "bg-amber-500/10" },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="flex items-center gap-3 bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl px-4 py-3">
                <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div>
                  <p className="text-xl font-bold leading-none">{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section visibility toggles ───────────────────────────────────────── */}
      {customizing && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
          {(["spotlight", "activity", "garage", "links"] as SectionKey[]).map(key => {
            const on = visible[key];
            return (
              <button
                key={key}
                onClick={() => toggleSection(key)}
                className={`flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  on
                    ? "bg-theme/10 border-theme/30 text-theme"
                    : "bg-secondary border-border text-muted-foreground"
                }`}
              >
                <span>{SECTION_LABELS[key]}</span>
                {on ? <Eye className="w-3.5 h-3.5 shrink-0" /> : <EyeOff className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Empty garage ─────────────────────────────────────────────────────── */}
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
        <div className="space-y-8">
          {/* ── Spotlight (up to 2 vehicles) ──────────────────────────────────── */}
          {visible.spotlight && spotlights.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Spotlight Build{spotlights.length > 1 ? "s" : ""}
              </h2>
              <div className={spotlights.length === 2 ? "grid grid-cols-1 lg:grid-cols-2 gap-4" : ""}>
                {spotlights.map(v => <SpotlightCard key={v.id} vehicle={v} />)}
              </div>
            </div>
          )}

          {/* ── Activity + Quick Links ────────────────────────────────────────── */}
          {(visible.activity || visible.links) && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {visible.activity && (
                <div className={visible.links ? "lg:col-span-2" : "lg:col-span-3"}>
                  <ActivityTimeline items={activity} />
                </div>
              )}
              {visible.links && (
                <div className={!visible.activity ? "lg:col-span-3" : ""}>
                  <QuickLinks />
                </div>
              )}
            </div>
          )}

          {/* ── All Vehicles (vehicles beyond the first 2) ────────────────────── */}
          {visible.garage && restVehicles.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">All Vehicles</h2>
                <Link href="/garage">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground h-7 px-2">
                    Manage <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {restVehicles.map(v => <GarageCard key={v.id} vehicle={v} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SpotlightCard({ vehicle }: { vehicle: Vehicle }) {
  const [imgErr, setImgErr] = useState(false);
  const completion = calcBuildCompletion(vehicle.modifications);
  const installedValue = vehicle.modifications
    .filter(m => m.status === "INSTALLED")
    .reduce((s, m) => s + (m.price ?? 0), 0);

  return (
    <Link href={`/garage/${vehicle.id}`} className="block group">
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card hover:border-theme/30 transition-colors duration-200 min-h-[160px]">
        {/* Photo strip */}
        {vehicle.photoUrl && !imgErr ? (
          <div className="absolute right-0 top-0 bottom-0 w-5/12 overflow-hidden">
            {vehicle.photoUrl.startsWith("data:") ? (
              <img
                src={vehicle.photoUrl}
                alt=""
                className="w-full h-full object-cover opacity-35 group-hover:opacity-50 transition-opacity duration-300"
                onError={() => setImgErr(true)}
              />
            ) : (
              <Image
                src={vehicle.photoUrl}
                alt=""
                fill
                className="object-cover opacity-35 group-hover:opacity-50 transition-opacity duration-300"
                onError={() => setImgErr(true)}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-card via-card/70 to-transparent" />
          </div>
        ) : (
          <div className="absolute right-0 top-0 bottom-0 w-5/12 bg-gradient-to-r from-card to-theme/5" />
        )}

        {/* Content */}
        <div className="relative p-6 max-w-[62%]">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-theme/10 ring-1 ring-theme/20 flex items-center justify-center shrink-0">
              <Car className="w-5 h-5 text-theme" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-lg leading-tight truncate">
                {vehicle.name || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}
              </h3>
              {vehicle.name && (
                <p className="text-sm text-muted-foreground">{vehicle.year} {vehicle.make} {vehicle.model}</p>
              )}
              {vehicle.trim && <Badge variant="outline" className="mt-1 text-xs">{vehicle.trim}</Badge>}
            </div>
          </div>

          <div className="space-y-1 mb-4">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Build progress</span>
              <span className="font-semibold">{completion}%</span>
            </div>
            <Progress value={completion} className="h-1.5" />
          </div>

          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border/60 mb-4">
            <div>
              <p className="text-xs text-muted-foreground">Mods</p>
              <p className="text-base font-bold">{vehicle._count.modifications}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Invested</p>
              <p className="text-base font-bold">{formatCurrency(installedValue)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Services</p>
              <p className="text-base font-bold">{vehicle._count.maintenanceLogs}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-theme text-sm font-medium group-hover:gap-3 transition-all duration-200">
            View full build <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </Link>
  );
}

function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  const shown = items.slice(0, 8);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-3.5 h-3.5 text-muted-foreground" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Activity</h2>
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-border">
          <Activity className="w-7 h-7 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">No activity yet — add a mod or log a service to get started.</p>
        </div>
      ) : (
        <div>
          {shown.map((item, i) => {
            const Icon = ACTIVITY_ICONS[item.type];
            const isLast = i === shown.length - 1;
            const href = item.vehicleId ? `/garage/${item.vehicleId}` : "/products";
            return (
              <Link key={item.id} href={href}>
                <div className="flex gap-3 group">
                  <div className="flex flex-col items-center shrink-0 w-5">
                    <div className={`w-2.5 h-2.5 rounded-full mt-2 shrink-0 ring-2 ring-background ${ACTIVITY_DOT[item.type]}`} />
                    {!isLast && <div className="w-px flex-1 bg-border/50 mt-1" />}
                  </div>
                  <div className={`flex-1 ${isLast ? "pb-0" : "pb-3"}`}>
                    <div className="rounded-xl px-3 py-2 group-hover:bg-secondary/60 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className={`w-3.5 h-3.5 shrink-0 ${ACTIVITY_ICON_COLOR[item.type]}`} />
                          <p className="text-sm font-medium truncate">{item.text}</p>
                        </div>
                        <span className="text-xs text-muted-foreground/50 shrink-0">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 pl-5">{item.sub}</p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function QuickLinks() {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Quick Access</h2>
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
        {QUICK_LINKS.map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href}>
            <div className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors group">
              <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <span className="text-sm font-medium flex-1">{label}</span>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function GarageCard({ vehicle }: { vehicle: Vehicle }) {
  const [imgErr, setImgErr] = useState(false);
  const completion = calcBuildCompletion(vehicle.modifications);
  return (
    <Link href={`/garage/${vehicle.id}`}>
      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 hover:border-theme/30 transition-colors group cursor-pointer">
        {vehicle.photoUrl && !imgErr ? (
          vehicle.photoUrl.startsWith("data:") ? (
            <img
              src={vehicle.photoUrl}
              alt=""
              className="w-12 h-12 rounded-lg object-cover shrink-0"
              onError={() => setImgErr(true)}
            />
          ) : (
            <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 relative">
              <Image src={vehicle.photoUrl} alt="" fill className="object-cover" onError={() => setImgErr(true)} />
            </div>
          )
        ) : (
          <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center shrink-0">
            <Car className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">
            {vehicle.name || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}
          </p>
          {vehicle.name && (
            <p className="text-xs text-muted-foreground truncate">{vehicle.year} {vehicle.make} {vehicle.model}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <Progress value={completion} className="h-1 flex-1" />
            <span className="text-xs text-muted-foreground shrink-0">{completion}%</span>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground shrink-0 transition-colors" />
      </div>
    </Link>
  );
}
