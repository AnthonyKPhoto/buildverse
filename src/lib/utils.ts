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
  { value: "RESEARCHING", label: "Researching", color: "bg-blue-500" },
  { value: "ORDERED", label: "Ordered", color: "bg-yellow-500" },
  { value: "PURCHASED", label: "Purchased", color: "bg-purple-500" },
  { value: "INSTALLED", label: "Installed", color: "bg-green-500" },
  { value: "REMOVED", label: "Removed", color: "bg-red-500" },
] as const;

export const MOD_PRIORITIES = [
  { value: "LOW", label: "Low", color: "text-slate-400" },
  { value: "MEDIUM", label: "Medium", color: "text-yellow-400" },
  { value: "HIGH", label: "High", color: "text-theme" },
  { value: "CRITICAL", label: "Critical", color: "text-red-400" },
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
  return MOD_PRIORITIES.find((p) => p.value === priority) ?? MOD_PRIORITIES[1];
}

export function calcBuildCompletion(modifications: { status: string }[]): number {
  if (!modifications.length) return 0;
  const installed = modifications.filter((m) => m.status === "INSTALLED").length;
  return Math.round((installed / modifications.length) * 100);
}

export function calcTotalModValue(modifications: { price?: number | null; status: string }[]): {
  installed: number;
  planned: number;
  total: number;
} {
  const installed = modifications
    .filter((m) => m.status === "INSTALLED")
    .reduce((sum, m) => sum + (m.price ?? 0), 0);
  const planned = modifications
    .filter((m) => m.status !== "INSTALLED")
    .reduce((sum, m) => sum + (m.price ?? 0), 0);
  return { installed, planned, total: installed + planned };
}
