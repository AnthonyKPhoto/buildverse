"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Car, DollarSign, TrendingUp, Plus, ArrowRight,
  Zap, ShoppingCart, ClipboardList, Package, BarChart3,
  Wrench, FolderOpen, Bell,
} from "lucide-react";
import { formatCurrency, calcBuildCompletion } from "@/lib/utils";

type ActivityType = "mod" | "service" | "file" | "alert";
interface ActivityItem {
  type: ActivityType;
  id: string;
  text: string;
  sub: string;
  vehicleId: string | null;
  createdAt: string;
}

interface Vehicle {
  id: string;
  name?: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  platform?: string;
  color?: string;
  modifications: { id: string; status: string; price?: number | null }[];
  _count: { modifications: number; maintenanceLogs: number };
}

const ACTIVITY_ICONS: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  mod: Wrench, service: ClipboardList, file: FolderOpen, alert: Bell,
};
const ACTIVITY_COLORS: Record<ActivityType, string> = {
  mod: "bg-theme/10 text-theme", service: "bg-blue-500/10 text-blue-400",
  file: "bg-purple-500/10 text-purple-400", alert: "bg-green-500/10 text-green-400",
};

export default function DashboardPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/vehicles").then((r) => r.json()),
      fetch("/api/activity").then((r) => r.json()),
    ]).then(([v, a]) => {
      setVehicles(Array.isArray(v) ? v : []);
      setActivity(Array.isArray(a) ? a : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Compute stats directly from vehicles data — avoids a separate DB call
  const stats = {
    vehicleCount: vehicles.length,
    modCount: vehicles.reduce((s, v) => s + v._count.modifications, 0),
    installedCount: vehicles.reduce(
      (s, v) => s + v.modifications.filter((m) => m.status === "INSTALLED").length, 0
    ),
    totalPlanned: vehicles.reduce(
      (s, v) => s + v.modifications.reduce((ms, m) => ms + (m.price ?? 0), 0), 0
    ),
    totalInstalled: vehicles.reduce(
      (s, v) =>
        s +
        v.modifications
          .filter((m) => m.status === "INSTALLED")
          .reduce((ms, m) => ms + (m.price ?? 0), 0),
      0
    ),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-muted-foreground text-sm">
          <div className="w-4 h-4 border-2 border-theme border-t-transparent rounded-full animate-spin" />
          Loading…
        </div>
      </div>
    );
  }

  const hasVehicles = vehicles.length > 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {`${stats.vehicleCount} vehicle${stats.vehicleCount !== 1 ? "s" : ""} · ${stats.modCount} modification${stats.modCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link href="/garage">
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Add Vehicle
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-lg overflow-hidden">
        {[
          { title: "Vehicles",      value: stats?.vehicleCount ?? 0,               sub: "in garage",          str: false },
          { title: "Modifications", value: stats?.modCount ?? 0,                   sub: `${stats?.installedCount ?? 0} installed`, str: false },
          { title: "Invested",      value: formatCurrency(stats?.totalInstalled),  sub: "in installed mods",  str: true },
          { title: "Planned",       value: formatCurrency(stats?.totalPlanned),    sub: "future spend",       str: true },
        ].map(({ title, value, sub, str }) => (
          <div key={title} className="bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{str ? value : (value as number).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Garage preview */}
      {hasVehicles ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Garage</h2>
            <Link href="/garage">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1 text-xs h-7 px-2">
                View all <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {vehicles.slice(0, 3).map((v) => {
              const completion = calcBuildCompletion(v.modifications);
              const installedValue = v.modifications
                .filter((m) => m.status === "INSTALLED")
                .reduce((s, m) => s + (m.price ?? 0), 0);
              return (
                <Link key={v.id} href={`/garage/${v.id}`}>
                  <Card className="hover:border-theme/30 transition-colors duration-150 cursor-pointer h-full">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm leading-tight">
                            {v.name || `${v.year} ${v.make} ${v.model}`}
                          </p>
                          {v.name && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {v.year} {v.make} {v.model}
                            </p>
                          )}
                        </div>
                        {v.trim && (
                          <Badge variant="outline" className="text-xs flex-shrink-0">{v.trim}</Badge>
                        )}
                      </div>

                      <div className="space-y-1.5 mb-3">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Build progress</span>
                          <span className="text-foreground font-medium">{completion}%</span>
                        </div>
                        <Progress value={completion} className="h-1" />
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border text-center">
                        <div>
                          <p className="text-xs text-muted-foreground">Mods</p>
                          <p className="text-sm font-semibold">{v._count.modifications}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Installed</p>
                          <p className="text-sm font-semibold">{formatCurrency(installedValue)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Services</p>
                          <p className="text-sm font-semibold">{v._count.maintenanceLogs}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center mb-4">
              <Zap className="w-7 h-7 text-theme" />
            </div>
            <h3 className="text-base font-semibold mb-1.5">Start your first build</h3>
            <p className="text-muted-foreground text-sm max-w-xs mb-5">
              Add your vehicle to start planning, tracking, and budgeting modifications.
            </p>
            <Link href="/garage">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Vehicle
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      {activity.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Recent Activity</h2>
          <div className="space-y-1.5">
            {activity.map((item) => {
              const Icon = ACTIVITY_ICONS[item.type];
              const colorClass = ACTIVITY_COLORS[item.type];
              const href = item.vehicleId ? `/garage/${item.vehicleId}` : "/products";
              return (
                <Link key={item.id} href={href}>
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/50 transition-colors group">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.text}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.sub}</p>
                    </div>
                    <span className="text-2xs text-muted-foreground/50 shrink-0">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Quick Access</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { href: "/budget",      icon: BarChart3,    label: "Budget" },
            { href: "/products",    icon: ShoppingCart, label: "Products" },
            { href: "/maintenance", icon: ClipboardList,label: "Maintenance" },
            { href: "/vendors",     icon: Package,      label: "Vendors" },
            { href: "/garage",      icon: Car,          label: "Garage" },
          ].map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href}>
              <Card className="hover:border-theme/25 transition-colors duration-150 cursor-pointer">
                <CardContent className="p-3 flex flex-col items-center gap-2">
                  <Icon className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <p className="text-xs font-medium text-center leading-tight">{label}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
