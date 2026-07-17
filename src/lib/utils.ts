import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export const MOD_CATEGORIES = [
  "Engine",
  "Turbo / Forced Induction",
  "Intake",
  "Exhaust",
  "Fuel System",
  "Cooling",
  "Transmission",
  "Drivetrain",
  "Suspension",
  "Brakes",
  "Wheels",
  "Tires",
  "Exterior",
  "Aerodynamics",
  "Interior",
  "Lighting",
  "Audio",
  "Electronics",
  "Safety",
  "Maintenance",
  "Other",
] as const;

export const MOD_STATUSES = [
  { value: "PLANNED", label: "Planned", color: "bg-slate-500" },
  { value: "RESEARCHING", label: "Researching / Idea", color: "bg-blue-500" },
  { value: "ORDERED", label: "Ordered", color: "bg-yellow-500" },
  { value: "PURCHASED", label: "Purchased", color: "bg-purple-500" },
  { value: "INSTALLED", label: "Installed", color: "bg-green-500" },
  { value: "REMOVED", label: "Removed", color: "bg-red-500" },
] as const;

export const MOD_PRIORITIES = [
  { value: "NONE",     label: "—",        color: "text-muted-foreground",  badge: "",                                                    dot: "" },
  { value: "LOW",      label: "Low",      color: "text-slate-400",         badge: "bg-slate-500/15 text-slate-400 border-slate-500/25",   dot: "bg-slate-400" },
  { value: "MEDIUM",   label: "Medium",   color: "text-amber-400",         badge: "bg-amber-500/15 text-amber-400 border-amber-500/25",   dot: "bg-amber-400" },
  { value: "HIGH",     label: "High",     color: "text-orange-400",        badge: "bg-orange-500/15 text-orange-400 border-orange-500/25", dot: "bg-orange-400" },
  { value: "CRITICAL", label: "Critical", color: "text-red-400",           badge: "bg-red-500/20 text-red-400 border-red-400/40",         dot: "bg-red-400" },
] as const;

export const INSTALL_DIFFICULTIES = [
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
  { value: "PROFESSIONAL", label: "Professional" },
] as const;

export const VEHICLE_MAKES = [
  "Acura", "Alfa Romeo", "Aston Martin", "Audi", "BMW", "Bentley",
  "Buick", "Cadillac", "Chevrolet", "Chrysler", "Dodge", "Ferrari",
  "Fiat", "Ford", "GMC", "Genesis", "Honda", "Hyundai", "Infiniti",
  "Jaguar", "Jeep", "Kia", "Lamborghini", "Land Rover", "Lexus",
  "Lincoln", "Lotus", "Maserati", "Mazda", "McLaren", "Mercedes-Benz",
  "Mini", "Mitsubishi", "Nissan", "Pontiac", "Porsche", "Ram",
  "Rolls-Royce", "Subaru", "Toyota", "Volkswagen", "Volvo", "Other",
];

export function getStatusConfig(status: string) {
  return MOD_STATUSES.find((s) => s.value === status) ?? MOD_STATUSES[0];
}

export function getPriorityConfig(priority: string) {
  // Treat legacy MEDIUM as NONE for display
  const key = priority === "MEDIUM" ? "NONE" : priority;
  return MOD_PRIORITIES.find((p) => p.value === key) ?? MOD_PRIORITIES[0];
}

export function calcBuildCompletion(modifications: { status: string }[]): number {
  if (!modifications.length) return 0;
  const installed = modifications.filter((m) => m.status === "INSTALLED").length;
  return Math.round((installed / modifications.length) * 100);
}

export const EXCLUDED_FROM_VALUE = new Set(["RESEARCHING", "REMOVED"]);

export function calcTotalModValue(modifications: { price?: number | null; actualPrice?: number | null; status: string }[]): {
  installed: number;
  planned: number;
  total: number;
} {
  const installed = modifications
    .filter((m) => m.status === "INSTALLED")
    .reduce((sum, m) => sum + (m.actualPrice ?? m.price ?? 0), 0);
  const planned = modifications
    .filter((m) => !EXCLUDED_FROM_VALUE.has(m.status) && m.status !== "INSTALLED")
    .reduce((sum, m) => sum + (m.price ?? 0), 0);
  return { installed, planned, total: installed + planned };
}
