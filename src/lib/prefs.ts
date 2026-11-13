// Extra per-user display preferences (beyond accent/radius/font/color mode,
// which live in ThemeProvider). Stored in this browser's localStorage, and —
// when signed in to a server — also on the account (User.prefs) so they follow
// the person to other devices. Safe to import anywhere: reads are guarded for SSR.

export type UiScale = "compact" | "default" | "large";
export type SidebarWidth = "narrow" | "default" | "wide";
export type DateFormat = "us" | "eu" | "iso";
export type Material = "classic" | "light-frosted" | "dark-frosted" | "clear-crystal";
export type Currency = "USD" | "EUR" | "GBP" | "CAD" | "AUD" | "JPY";

export interface Prefs {
  uiScale: UiScale;
  sidebarWidth: SidebarWidth;
  reduceMotion: boolean;
  currency: Currency;
  showCents: boolean;
  dateFormat: DateFormat;
  /** Surface style: the original look, or one of three frosted-glass materials. */
  material: Material;
}

export const DEFAULT_PREFS: Prefs = {
  uiScale: "default",
  sidebarWidth: "default",
  reduceMotion: false,
  currency: "USD",
  showCents: false,
  dateFormat: "us",
  material: "classic",
};

export const MATERIALS: { id: Material; label: string; hint: string; swatch: string; scheme: "light" | "dark" | "user" }[] = [
  { id: "classic",       label: "Classic",       hint: "Your current look — solid surfaces", swatch: "linear-gradient(135deg,#1b2333,#0a0e17)", scheme: "user" },
  { id: "light-frosted", label: "Light Frosted", hint: "Airy white translucent glass",       swatch: "linear-gradient(135deg,#ffd1ea,#b9d7ff 55%,#c9f5dc)", scheme: "light" },
  { id: "dark-frosted",  label: "Dark Frosted",  hint: "Smoked obsidian glass",              swatch: "linear-gradient(135deg,#7c3aed,#ec4899 50%,#0ea5e9)", scheme: "dark" },
  { id: "clear-crystal", label: "Clear Crystal", hint: "Near-transparent, sharp reflections", swatch: "linear-gradient(135deg,#ff3d81,#ffb300 45%,#00d4ff)", scheme: "dark" },
];

export const UI_SCALES: { id: UiScale; label: string; fontSize: string }[] = [
  { id: "compact", label: "Compact", fontSize: "93.75%" },
  { id: "default", label: "Default", fontSize: "100%" },
  { id: "large",   label: "Large",   fontSize: "109.375%" },
];
export const SIDEBAR_WIDTHS: { id: SidebarWidth; label: string; px: number }[] = [
  { id: "narrow",  label: "Narrow",  px: 208 },
  { id: "default", label: "Default", px: 240 },
  { id: "wide",    label: "Wide",    px: 280 },
];
export const CURRENCIES: { id: Currency; label: string }[] = [
  { id: "USD", label: "US Dollar ($)" },
  { id: "EUR", label: "Euro (€)" },
  { id: "GBP", label: "British Pound (£)" },
  { id: "CAD", label: "Canadian Dollar (CA$)" },
  { id: "AUD", label: "Australian Dollar (A$)" },
  { id: "JPY", label: "Japanese Yen (¥)" },
];
export const DATE_FORMATS: { id: DateFormat; label: string; example: string }[] = [
  { id: "us",  label: "US",   example: "Nov 13, 2026" },
  { id: "eu",  label: "EU",   example: "13 Nov 2026" },
  { id: "iso", label: "ISO",  example: "2026-11-13" },
];

const KEY = "bv-prefs";

/** Validates untrusted input (localStorage, or the server) down to known-good values. */
export function sanitizePrefs(input: unknown): Partial<Prefs> {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Partial<Prefs> = {};
  if (UI_SCALES.some((x) => x.id === o.uiScale)) out.uiScale = o.uiScale as UiScale;
  if (SIDEBAR_WIDTHS.some((x) => x.id === o.sidebarWidth)) out.sidebarWidth = o.sidebarWidth as SidebarWidth;
  if (typeof o.reduceMotion === "boolean") out.reduceMotion = o.reduceMotion;
  if (CURRENCIES.some((x) => x.id === o.currency)) out.currency = o.currency as Currency;
  if (typeof o.showCents === "boolean") out.showCents = o.showCents;
  if (DATE_FORMATS.some((x) => x.id === o.dateFormat)) out.dateFormat = o.dateFormat as DateFormat;
  if (MATERIALS.some((x) => x.id === o.material)) out.material = o.material as Material;
  return out;
}

let cached: Prefs | null = null;

export function getPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(KEY);
    cached = { ...DEFAULT_PREFS, ...(raw ? sanitizePrefs(JSON.parse(raw)) : {}) };
  } catch {
    cached = { ...DEFAULT_PREFS };
  }
  return cached;
}

export function applyPrefs(prefs: Prefs) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.fontSize = UI_SCALES.find((s) => s.id === prefs.uiScale)?.fontSize ?? "100%";
  root.style.setProperty("--sidebar-width", `${SIDEBAR_WIDTHS.find((s) => s.id === prefs.sidebarWidth)?.px ?? 240}px`);
  root.classList.toggle("reduce-motion", prefs.reduceMotion);
  if (prefs.material === "classic") root.removeAttribute("data-material");
  else root.setAttribute("data-material", prefs.material);
  syncSchemeClass(prefs);
}

/**
 * Light/dark is normally the user's own "Color mode" choice. A frosted material
 * dictates its own scheme (Light Frosted is light; the other two are dark), and the
 * user's saved choice is restored when they go back to Classic.
 */
export function syncSchemeClass(prefs: Prefs = getPrefs()) {
  if (typeof document === "undefined") return;
  const m = MATERIALS.find((x) => x.id === prefs.material);
  let saved = "dark";
  try { saved = localStorage.getItem("bv-scheme") ?? "dark"; } catch { /* ignore */ }
  const light = m && m.scheme !== "user" ? m.scheme === "light" : saved === "light";
  document.documentElement.classList.toggle("light", light);
}

const EVENT = "bv-prefs-changed";
/** Subscribe to preference changes (used by the usePrefs() hook in src/hooks/use-prefs.ts). */
export function subscribePrefs(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}
const notify = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT)); };

/** Merge a change in, persist locally, apply it, and (best effort) save to the account. */
export function setPrefs(partial: Partial<Prefs>) {
  const next = { ...getPrefs(), ...sanitizePrefs(partial) };
  cached = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode etc. */ }
  applyPrefs(next);
  notify();
  // No-op (401, swallowed) in local mode / when signed out — same as the theme sync.
  fetch("/api/user/theme", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefs: partial }),
  }).catch(() => {});
  return next;
}

/** Called by ThemeProvider with the account's saved prefs (server mode). */
export function loadServerPrefs(server: unknown) {
  const merged = { ...getPrefs(), ...sanitizePrefs(server) };
  cached = merged;
  try { localStorage.setItem(KEY, JSON.stringify(merged)); } catch { /* ignore */ }
  applyPrefs(merged);
  notify();
}
