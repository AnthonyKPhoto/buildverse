"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingUp, TrendingDown, Car, BarChart3, ArrowRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface Budget {
  id: string; vehicleId: string; category: string; planned: number; actual: number; notes?: string;
}

interface Vehicle {
  id: string; name?: string; year: number; make: string; model: string;
  budgets: Budget[];
  modifications: { price?: number | null; actualPrice?: number | null; status: string }[];
}

const CHART_COLORS = [
  "#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ef4444",
  "#06b6d4", "#eab308", "#ec4899", "#14b8a6", "#8b5cf6",
];

export default function BudgetPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState("ALL");

  useEffect(() => {
    fetch("/api/vehicles")
      .then((r) => r.json())
      .then((v) => {
        setVehicles(Array.isArray(v) ? v : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="w-5 h-5 border-2 border-theme border-t-transparent rounded-full animate-spin" />
          Loading budget…
        </div>
      </div>
    );
  }

  // Filter vehicles
  const filteredVehicles = selectedVehicle === "ALL"
    ? vehicles
    : vehicles.filter((v) => v.id === selectedVehicle);

  // Aggregate budgets across selected vehicles
  const categoryMap: Record<string, { planned: number; actual: number }> = {};
  for (const v of filteredVehicles) {
    for (const b of v.budgets) {
      if (!categoryMap[b.category]) categoryMap[b.category] = { planned: 0, actual: 0 };
      categoryMap[b.category].planned += b.planned;
      categoryMap[b.category].actual += b.actual;
    }
  }

  const budgetData = Object.entries(categoryMap)
    .map(([category, vals]) => ({ category, ...vals }))
    .sort((a, b) => b.planned - a.planned);

  const totalPlanned = budgetData.reduce((s, b) => s + b.planned, 0);

  // Total spent = sum of actual/estimated price for installed mods (automatic, no manual entry needed)
  const totalSpent = filteredVehicles.reduce(
    (total, v) =>
      total +
      v.modifications
        .filter((m) => m.status === "INSTALLED")
        .reduce((s, m) => s + ((m.actualPrice ?? m.price) ?? 0), 0),
    0
  );
  const totalRemaining = totalPlanned - totalSpent;

  // Pie chart data (planned)
  const pieData = budgetData.slice(0, 8).map((b, i) => ({
    name: b.category,
    value: b.planned,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  // Per-vehicle summary
  const vehicleSummaries = vehicles.map((v) => {
    const planned = v.budgets.reduce((s, b) => s + b.planned, 0);
    const actual = v.modifications
      .filter((m) => m.status === "INSTALLED")
      .reduce((s, m) => s + ((m.actualPrice ?? m.price) ?? 0), 0);
    return { ...v, planned, actual };
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budget Planner</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track planned vs actual spending across your builds</p>
        </div>
        <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Vehicles</SelectItem>
            {vehicles.map((v) => (
              <SelectItem key={v.id} value={v.id}>{v.name || `${v.year} ${v.make} ${v.model}`}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {vehicles.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <DollarSign className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No budget data yet</h3>
            <p className="text-muted-foreground text-sm mb-6">Add a vehicle and set budget targets per category</p>
            <Link href="/garage">
              <Button><Car className="w-4 h-4 mr-2" />Go to Garage</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Total Budget", value: formatCurrency(totalPlanned), sub: "planned spend", icon: TrendingUp, color: "text-blue-400 bg-blue-500/10" },
              { label: "Total Spent", value: formatCurrency(totalSpent), sub: "installed mods value", icon: DollarSign, color: "text-green-400 bg-green-500/10" },
              {
                label: totalRemaining >= 0 ? "Remaining" : "Over Budget",
                value: formatCurrency(Math.abs(totalRemaining)),
                sub: totalRemaining >= 0 ? "left in budget" : "over budget",
                icon: totalRemaining >= 0 ? TrendingDown : TrendingUp,
                color: totalRemaining >= 0 ? "text-theme bg-theme/10" : "text-red-400 bg-red-500/10",
              },
            ].map(({ label, value, sub, icon: Icon, color }) => (
              <Card key={label}>
                <CardContent className="p-5 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-xl font-bold">{value}</p>
                    <p className="text-xs text-muted-foreground">{sub}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {budgetData.length > 0 ? (
            <>
              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar chart */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-theme" />
                      Planned vs Actual by Category
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={budgetData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
                        <XAxis
                          dataKey="category"
                          tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }}
                          tickFormatter={(v) => v.length > 10 ? v.slice(0, 10) + "…" : v}
                        />
                        <YAxis tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "hsl(222 47% 9%)", border: "1px solid hsl(217 33% 17%)", borderRadius: "8px" }}
                          formatter={(v: number) => formatCurrency(v)}
                        />
                        <Bar dataKey="planned" fill="#3b82f6" name="Planned" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="actual" fill="#f97316" name="Actual" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Pie chart */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-theme" />
                      Budget Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          innerRadius={50}
                          paddingAngle={2}
                        >
                          {pieData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: "hsl(222 47% 9%)", border: "1px solid hsl(217 33% 17%)", borderRadius: "8px" }}
                          formatter={(v: number) => formatCurrency(v)}
                        />
                        <Legend
                          formatter={(value) => <span style={{ color: "hsl(215 20% 55%)", fontSize: 12 }}>{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Category breakdown table */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Category Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {budgetData.map((b, i) => {
                    const pct = b.planned > 0 ? Math.min(100, (b.actual / b.planned) * 100) : 0;
                    const over = b.actual > b.planned;
                    return (
                      <div key={b.category} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                            <span className="font-medium">{b.category}</span>
                            {over && <Badge className="text-xs bg-red-500/20 text-red-400 border-red-500/30">Over</Badge>}
                          </div>
                          <div className="flex items-center gap-4 text-muted-foreground">
                            <span>{formatCurrency(b.actual)} spent</span>
                            <span className="text-foreground font-medium">/ {formatCurrency(b.planned)}</span>
                            <span className="w-10 text-right">{Math.round(pct)}%</span>
                          </div>
                        </div>
                        <Progress
                          value={pct}
                          className={`h-2 ${over ? "[&>div]:bg-red-500" : ""}`}
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center py-10 text-center">
                <BarChart3 className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="font-medium mb-1">No budget categories set</p>
                <p className="text-sm text-muted-foreground mb-4">Set budget targets in your vehicle&apos;s Build page</p>
              </CardContent>
            </Card>
          )}

          {/* Per-vehicle summary */}
          {selectedVehicle === "ALL" && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">Per Vehicle Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vehicleSummaries.map((v) => (
                  <Link key={v.id} href={`/garage/${v.id}`}>
                    <Card className="hover:border-theme/30 transition-colors cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <Car className="w-4 h-4 text-theme" />
                          <span className="font-medium text-sm">{v.name || `${v.year} ${v.make} ${v.model}`}</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground ml-auto" />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Planned</p>
                            <p className="font-semibold">{formatCurrency(v.planned)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Spent</p>
                            <p className="font-semibold">{formatCurrency(v.actual)}</p>
                          </div>
                        </div>
                        {v.planned > 0 && (
                          <Progress value={Math.min(100, (v.actual / v.planned) * 100)} className="h-1.5 mt-3" />
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
