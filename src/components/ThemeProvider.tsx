"use client";

import { useEffect, useState } from "react";

export const ACCENT_PRESETS = [
  { id: "orange", label: "Orange", value: "24 90% 58%" },
  { id: "amber",  label: "Amber",  value: "38 92% 52%" },
  { id: "blue",   label: "Blue",   value: "217 91% 60%" },
  { id: "indigo", label: "Indigo", value: "243 75% 65%" },
  { id: "violet", label: "Violet", value: "262 83% 68%" },
  { id: "green",  label: "Green",  value: "142 71% 45%" },
  { id: "teal",   label: "Teal",   value: "174 72% 46%" },
  { id: "rose",   label: "Rose",   value: "347 77% 60%" },
];

export function applyAccent(id: string) {
  const preset = ACCENT_PRESETS.find((p) => p.id === id) ?? ACCENT_PRESETS[0];
  const root = document.documentElement;
  root.style.setProperty("--theme", preset.value);
  root.style.setProperty("--ring", preset.value);
  localStorage.setItem("bv-accent", id);
}

export function useCurrentAccent() {
  const [accent, setAccentState] = useState("orange");

  useEffect(() => {
    const saved = localStorage.getItem("bv-accent") ?? "orange";
    setAccentState(saved);
  }, []);

  return {
    accent,
    setAccent: (id: string) => {
      applyAccent(id);
      setAccentState(id);
    },
  };
}

export function ThemeProvider() {
  useEffect(() => {
    const saved = localStorage.getItem("bv-accent") ?? "orange";
    applyAccent(saved);
  }, []);
  return null;
}
