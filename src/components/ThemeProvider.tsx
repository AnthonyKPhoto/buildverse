"use client";

import { useEffect, useState } from "react";

export const ACCENT_PRESETS = [
  { id: "blue",    label: "Blue",         value: "217 91% 60%",  hex: "#3b82f6" },
  { id: "indigo",  label: "Indigo",       value: "239 84% 67%",  hex: "#6366f1" },
  { id: "violet",  label: "Violet",       value: "262 83% 68%",  hex: "#8b5cf6" },
  { id: "purple",  label: "Purple",       value: "271 76% 63%",  hex: "#a855f7" },
  { id: "pink",    label: "Pink",         value: "328 86% 65%",  hex: "#ec4899" },
  { id: "rose",    label: "Rose",         value: "347 77% 60%",  hex: "#f43f5e" },
  { id: "red",     label: "Red",          value: "0 84% 60%",    hex: "#f87171" },
  { id: "orange",  label: "Orange",       value: "24 94% 58%",   hex: "#f97316" },
  { id: "amber",   label: "Amber",        value: "38 92% 52%",   hex: "#f59e0b" },
  { id: "lime",    label: "Lime",         value: "84 81% 44%",   hex: "#84cc16" },
  { id: "green",   label: "Green",        value: "142 71% 45%",  hex: "#22c55e" },
  { id: "teal",    label: "Teal",         value: "174 72% 46%",  hex: "#14b8a6" },
  { id: "cyan",    label: "Cyan",         value: "192 91% 50%",  hex: "#06b6d4" },
  { id: "sky",     label: "Sky",          value: "199 89% 48%",  hex: "#0ea5e9" },
];

export const RADIUS_PRESETS = [
  { id: "sharp",   label: "Sharp",   value: "0.375rem" },
  { id: "default", label: "Default", value: "0.75rem"  },
  { id: "rounded", label: "Rounded", value: "1rem"     },
  { id: "pill",    label: "Pill",    value: "1.5rem"   },
];

export const FONT_PRESETS = [
  { id: "inter",   label: "Inter",         value: "'Inter', system-ui, -apple-system, sans-serif" },
  { id: "grotesk", label: "Space Grotesk", value: "'Space Grotesk', system-ui, -apple-system, sans-serif" },
  { id: "system",  label: "System",        value: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { id: "mono",    label: "Mono",          value: "ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace" },
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

export function applyFont(id: string) {
  const preset = FONT_PRESETS.find((p) => p.id === id) ?? FONT_PRESETS[0];
  document.documentElement.style.setProperty("--font-body", preset.value);
  localStorage.setItem("bv-font", id);
}

export function applyScheme(id: string) {
  if (id === "light") {
    document.documentElement.classList.add("light");
  } else {
    document.documentElement.classList.remove("light");
  }
  localStorage.setItem("bv-scheme", id);
}

// Best-effort push to the signed-in account's own record, so their look
// follows them to another browser/device. A no-op (401, swallowed) in
// local/Electron mode or when nobody's signed in — never surfaced to the
// user since there's nothing actionable for them to do about it.
function syncThemeToServer(partial: Partial<{ accentColor: string; radius: string; font: string; colorScheme: string }>) {
  fetch("/api/user/theme", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(partial),
  }).catch(() => {});
}

export function useCurrentAccent() {
  const [accent, setAccentState] = useState("blue");
  useEffect(() => {
    const saved = localStorage.getItem("bv-accent") ?? "blue";
    setAccentState(saved);
  }, []);
  return {
    accent,
    setAccent: (id: string) => { applyAccent(id); setAccentState(id); syncThemeToServer({ accentColor: id }); },
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
    setRadius: (id: string) => { applyRadius(id); setRadiusState(id); syncThemeToServer({ radius: id }); },
  };
}

export function useCurrentFont() {
  const [font, setFontState] = useState("inter");
  useEffect(() => {
    const saved = localStorage.getItem("bv-font") ?? "inter";
    setFontState(saved);
  }, []);
  return {
    font,
    setFont: (id: string) => { applyFont(id); setFontState(id); syncThemeToServer({ font: id }); },
  };
}

export function useCurrentScheme() {
  const [scheme, setSchemeState] = useState("dark");
  useEffect(() => {
    const saved = localStorage.getItem("bv-scheme") ?? "dark";
    setSchemeState(saved);
  }, []);
  return {
    scheme,
    setScheme: (id: string) => { applyScheme(id); setSchemeState(id); syncThemeToServer({ colorScheme: id }); },
  };
}

export function ThemeProvider() {
  useEffect(() => {
    // Fast path: apply the last-known values immediately (avoids a flash of
    // default theme), from this browser's own localStorage.
    applyAccent(localStorage.getItem("bv-accent") ?? "blue");
    applyRadius(localStorage.getItem("bv-radius") ?? "default");
    applyFont(localStorage.getItem("bv-font") ?? "inter");
    applyScheme(localStorage.getItem("bv-scheme") ?? "dark");

    // Authoritative: in server mode with a real signed-in identity, the
    // account's own saved theme (if any) overrides the local fallback above
    // — this is what makes the look follow the account across devices.
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(({ user }) => {
        if (!user) return;
        if (user.accentColor) applyAccent(user.accentColor);
        if (user.radius) applyRadius(user.radius);
        if (user.font) applyFont(user.font);
        if (user.colorScheme) applyScheme(user.colorScheme);
      })
      .catch(() => {});
  }, []);
  return null;
}
