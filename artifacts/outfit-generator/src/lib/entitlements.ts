/**
 * Entitlement tier definitions — single source of truth for limits and capabilities.
 *
 * Tiers:
 *   "free"   — default; up to FREE_ITEM_LIMIT items, FREE_OUTFIT_LIMIT saved lists.
 *   "unlock" — paid (any plan); unlimited items + lists.
 *
 * Active entitlement identifier in RevenueCat: "My Digital Books Pro"
 * Mapped in useEntitlements: isSubscribed → "unlock", otherwise → "free".
 */

export type Tier = "free" | "unlock";

/** Adjust these constants to run promotions or A/B tests without touching logic. */
export const FREE_ITEM_LIMIT   = 20;
export const FREE_OUTFIT_LIMIT = 5;

export interface TierCapabilities {
  /** Maximum items, or null for unlimited. */
  maxItems:   number | null;
  /** Maximum saved lists, or null for unlimited. */
  maxOutfits: number | null;
}

export const TIER_CAPS: Record<Tier, TierCapabilities> = {
  free:   { maxItems: FREE_ITEM_LIMIT, maxOutfits: FREE_OUTFIT_LIMIT },
  unlock: { maxItems: null,            maxOutfits: null              },
};
