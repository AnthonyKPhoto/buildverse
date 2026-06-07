"use client";

import { useEffect, useState } from "react";

export const ACCENT_PRESETS = [
  { id: "blue",    label: "Blue",    value: "217 91% 60%",  hex: "#3b82f6" },
  { id: "indigo",  label: "Indigo",  value: "239 84% 67%",  hex: "#6366f1" },
  { id: "violet",  label: "Violet",  value: "262 83% 68%",  hex: "#8b5cf6" },
  { id: "purple",  label: "Purple",  value: "271 76% 63%",  hex: "#a855f7" },
  { id: "rose",    label: "Rose",    value: "347 77% 60%",  hex: "#f43f5e" },
  { id: "orange",  label: "Orange",  value: "24 94% 58%",   hex: "#f97316" },
  { id: "amber",   label: "Amber",   value: "38 92% 52%",   hex: "#f59e0b" },
  { id: "green",   label: "Green",   value: "142 71% 45%",  hex: "#22c55e" },
  { id: "teal",    label: "Teal",    value: "174 72% 46%",  hex: "#14b8a6" },
  { id: "cyan",    label: "Cyan",    value: "192 91% 50%",  hex: "#06b6d4" },
];

export const RADIUS_PRESETS = [
  { id: "sharp",   label: "Sharp",   value: "0.375rem" },
  { id: "default", label: "Default", value: "0.75rem"  },
  { id: "rounded", label: "Rounded", value: "1rem"     },
  { id: "pill",    label: "Pill",    value: "1.5rem"   },
];

export function applyAccent(id: string) {
  const preset = ACCENT_PRESETS.find((p) => p.id === id) ?? ACCENT_PRESETS[0];
  const root = document.documentElement;
  root.style.setProperty("--theme", preset.value);
  root.style.setProperty("--ring",  preset.value);
  root.style.setProperty("--primary", preset.value);
  localStorage.setItem("bv-accent", id);
}

export function applyRadius(id: string) {
  const preset = RADIUS_PRESETS.find((p) => p.id === id) ?? RADIUS_PRESETS[1];
  document.documentElement.style.setProperty("--radius", preset.value);
  localStorage.setItem("bv-radius", id);
}

export function useCurrentAccent() {
  const [accent, setAccentState] = useState("blue");
  useEffect(() => {
    const saved = localStorage.getItem("bv-accent") ?? "blue";
    setAccentState(saved);
  }, []);
  return {
    accent,
    setAccent: (id: string) => { applyAccent(id); setAccentState(id); },
  };
}

export function useCurrentRadius() {
  const [radius, setRadiusState] = useState("default");
  useEffect(() => {
    const saved = localStorage.getItem("bv-radius") ?? "default";
    setRadiusState(saved);
  }, []);
  return {
    radius,
    setRadius: (id: string) => { applyRadius(id); setRadiusState(id); },
  };
}

export function ThemeProvider() {
  useEffect(() => {
    applyAccent(localStorage.getItem("bv-accent") ?? "blue");
    applyRadius(localStorage.getItem("bv-radius") ?? "default");
  }, []);
  return null;
}
