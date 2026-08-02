/**
 * useSearch — scored full-text search across clothing items and saved outfits.
 *
 * Weights (highest → lowest):
 *   name, brand   10/8   — user-typed metadata, highest intent signal
 *   color, notes  4/3    — medium-weight descriptors
 *   category      4      — display names from useCategoryNames
 *   size/season/  2 each — lower-intent metadata
 *   occasion
 *   visionLabels  1      — Vision/canvas labels (broad, noisy)
 *   visionText    1      — OCR text from photo
 *
 * Returns null when the query is empty so callers can skip rendering results.
 */

import { useMemo } from "react";
import { useListClothing, useListOutfits } from "@/hooks/useLocalDB";
import type { ClothingItem, SavedOutfit } from "@/lib/db";
import { useCategoryNames } from "@/hooks/useCategoryNames";

export interface SearchResults {
  items:  ClothingItem[];
  groups: SavedOutfit[];
}

function scoreItem(
  item: ClothingItem,
  q: string,
  categoryDisplay: string,
): number {
  let score = 0;

  const check = (text: string | null | undefined, weight: number) => {
    if (text && text.toLowerCase().includes(q)) score += weight;
  };

  check(item.name,          10);
  check(item.brand,          8);
  check(item.color,          4);
  check(item.notes,          3);
  check(categoryDisplay,     4);
  check(item.size,           2);
  check(item.season,         2);
  check(item.occasion,       2);
  check(item.purchasePrice,  1);
  check((item.visionLabels ?? []).join(" "), 1);
  check((item.visionText   ?? []).join(" "), 1);

  return score;
}

/**
 * Returns scored search results, or null when `query` is blank/whitespace.
 */
export function useSearch(query: string): SearchResults | null {
  const { data: items  = [] } = useListClothing({});
  const { data: groups = [] } = useListOutfits();
  const { names }              = useCategoryNames();

  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;

    // ── Items ──
    const scoredItems = items
      .map((item) => {
        const catDisplay = names[item.category as keyof typeof names] ?? item.category;
        return { item, score: scoreItem(item, q, catDisplay) };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);

    // ── Groups: match on name/notes OR if any member item matches ──
    const matchedItemIds = new Set(scoredItems.map((i) => i.id));

    const matchedGroups = groups.filter((group) => {
      const nameMatch  = group.name?.toLowerCase().includes(q);
      const notesMatch = group.notes?.toLowerCase().includes(q);
      const itemMatch  = (group.items ?? []).some((i) => matchedItemIds.has(i.id));
      return nameMatch || notesMatch || itemMatch;
    });

    return { items: scoredItems, groups: matchedGroups };
  }, [query, items, groups, names]);
}
