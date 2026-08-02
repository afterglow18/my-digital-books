/**
 * useCategoryNames — persists user-defined row heading names in localStorage.
 * Cross-component reactive: calling setName in any component immediately
 * updates every other mounted component using this hook.
 */

import { useState, useCallback, useEffect } from "react";

export type CategoryKey = "outfits" | "beauty" | "toiletries" | "essentials";

export const CATEGORY_KEYS: CategoryKey[] = ["outfits", "beauty", "toiletries", "essentials"];

export const DEFAULT_NAMES: Record<CategoryKey, string> = {
  outfits:    "Books",
  beauty:     "Authors",
  toiletries: "Series",
  essentials: "Bookmarks",
};

const LS_KEY    = "category-names-v1";
const EVT_KEY   = "category-names-changed";

// Values written by old builds that used a different default set.
// If a stored name matches one of these exactly we treat it as
// "still default" and replace it with the current default.
const LEGACY_DEFAULTS: Record<CategoryKey, string> = {
  outfits:    "Fiction",
  beauty:     "Non-Fiction",
  toiletries: "Self-Help",
  essentials: "Wishlisted",
};

function migrate(value: string | undefined, key: CategoryKey): string {
  if (!value) return DEFAULT_NAMES[key];
  // If the stored value is a legacy default, swap in the current default
  if (value === LEGACY_DEFAULTS[key]) return DEFAULT_NAMES[key];
  return value;
}

function load(): Record<CategoryKey, string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_NAMES };
    const parsed = JSON.parse(raw) as Partial<Record<CategoryKey, string>>;
    const result: Record<CategoryKey, string> = {
      outfits:    migrate(parsed.outfits,    "outfits"),
      beauty:     migrate(parsed.beauty,     "beauty"),
      toiletries: migrate(parsed.toiletries, "toiletries"),
      essentials: migrate(parsed.essentials, "essentials"),
    };
    // Persist the migrated values so the next load is already clean
    try { localStorage.setItem(LS_KEY, JSON.stringify(result)); } catch {}
    return result;
  } catch {
    return { ...DEFAULT_NAMES };
  }
}

export function useCategoryNames() {
  const [names, setNames] = useState<Record<CategoryKey, string>>(load);

  // Stay in sync when another component in the same session updates names
  useEffect(() => {
    const handler = () => setNames(load());
    window.addEventListener(EVT_KEY, handler);
    return () => window.removeEventListener(EVT_KEY, handler);
  }, []);

  const setName = useCallback((key: CategoryKey, value: string) => {
    const trimmed = value.trim() || DEFAULT_NAMES[key];
    setNames((prev) => {
      const next = { ...prev, [key]: trimmed };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    // Notify every other mounted instance
    window.dispatchEvent(new CustomEvent(EVT_KEY));
  }, []);

  return { names, setName };
}
