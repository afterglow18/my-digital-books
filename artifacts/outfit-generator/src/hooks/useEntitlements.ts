/**
 * useEntitlements — maps RevenueCat subscription state to the app's tier/caps model.
 *
 * Tier mapping:
 *   no active "My Digital Books Pro" entitlement → "free"  (up to 20 items, 5 lists)
 *   active entitlement                           → "unlock" (unlimited)
 */
import { useCallback } from "react";
import { Tier, TIER_CAPS, TierCapabilities } from "@/lib/entitlements";
import { useSubscription } from "@/lib/revenuecat";

export function useEntitlements() {
  const { isSubscribed } = useSubscription();

  const tier: Tier = isSubscribed ? "unlock" : "free";
  const caps: TierCapabilities = TIER_CAPS[tier];

  const canAddItem = useCallback(
    (count: number) => caps.maxItems === null || count < caps.maxItems,
    [caps.maxItems],
  );

  const canSaveOutfit = useCallback(
    (count: number) => caps.maxOutfits === null || count < caps.maxOutfits,
    [caps.maxOutfits],
  );

  return { tier, caps, canAddItem, canSaveOutfit };
}
