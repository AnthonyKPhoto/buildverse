"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_PREFS, getPrefs, subscribePrefs, type Prefs } from "@/lib/prefs";

/** Re-renders the component whenever any display preference changes. */
export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribePrefs, getPrefs, () => DEFAULT_PREFS);
}
