/**
 * UpgradeSheet — three-tier paywall (Monthly / Yearly / Lifetime).
 * Visual: plaid navy + tan hero header, navy/tan accent scheme throughout.
 */
import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Check } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { useSubscription } from "@/lib/revenuecat";

export type UpgradeReason = "items" | "outfits" | "mannequin";
type TierId = "monthly" | "yearly" | "lifetime";

interface Props {
  reason:  UpgradeReason;
  onClose: () => void;
}

// ── Palette ───────────────────────────────────────────────────────────────────
const NAVY    = "#060E1F";   // deep midnight navy
const TAN     = "#D4B896";   // app primary tan (hsl 35 55% 82%)
const TAN_DK  = "#C4A07A";   // darker tan — borders & shadows
const CREAM   = "#F5EAD4";   // warm parchment text

// CSS plaid: fine tan lines on midnight navy
const PLAID_BG = `
  repeating-linear-gradient(0deg,  transparent, transparent 24px, rgba(212,184,150,0.22) 24px, rgba(212,184,150,0.22) 26px),
  repeating-linear-gradient(90deg, transparent, transparent 24px, rgba(212,184,150,0.22) 24px, rgba(212,184,150,0.22) 26px),
  repeating-linear-gradient(0deg,  transparent, transparent 80px, rgba(212,184,150,0.10) 80px, rgba(212,184,150,0.10) 83px),
  repeating-linear-gradient(90deg, transparent, transparent 80px, rgba(212,184,150,0.10) 80px, rgba(212,184,150,0.10) 83px),
  ${NAVY}
`.trim();

// ── Copy ──────────────────────────────────────────────────────────────────────

const HEADLINES: Record<UpgradeReason, string> = {
  items:     "UNLOCK YOUR UNLIMITED DIGITAL LIBRARY",
  outfits:   "UNLOCK YOUR UNLIMITED DIGITAL LIBRARY",
  mannequin: "UNLOCK YOUR UNLIMITED DIGITAL LIBRARY",
};

const SUBTITLES: Record<UpgradeReason, string> = {
  items:     "You've reached the free 20 item limit.\nUpgrade once, read everything.",
  outfits:   "You've hit the free list limit. Upgrade to save every list.",
  mannequin: "A premium feature — unlock it once.",
};

const TIER_DEFAULTS: Record<TierId, {
  label: string; price: string; period: string;
  notes: [string, string]; pkgId: string; best?: true;
}> = {
  monthly:  { label: "MONTHLY",  price: "$1.99",  period: "/month",   notes: ["Cancel anytime", "Billed monthly"],  pkgId: "$rc_monthly"  },
  yearly:   { label: "YEARLY",   price: "$19.99", period: "/year",    notes: ["Save 17%",       "Billed yearly"],   pkgId: "$rc_annual"   },
  lifetime: { label: "LIFETIME", price: "$9.99",  period: "one-time", notes: ["Pay once",       "Yours forever"],   pkgId: "$rc_lifetime", best: true },
};

const TIER_ORDER: TierId[] = ["monthly", "yearly", "lifetime"];

// ── RC helpers ────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getRcPackage(offerings: any, pkgId: string): any | undefined {
  return offerings?.current?.availablePackages?.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p: any) => p.identifier === pkgId,
  );
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getLivePrice(offerings: any, pkgId: string, fallback: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getRcPackage(offerings, pkgId) as any)?.product?.priceString ?? fallback;
}

// ── Tier card ─────────────────────────────────────────────────────────────────

function TierCard({
  id, selected, onSelect, price, period, notes, label, best,
}: {
  id: TierId; selected: boolean; onSelect: (id: TierId) => void;
  price: string; period: string; notes: [string, string]; label: string; best?: true;
}) {
  return (
    <button
      onClick={() => onSelect(id)}
      className="flex-1 flex flex-col rounded-xl border-[3px] transition-all relative overflow-hidden text-left"
      style={{
        borderColor: selected ? TAN_DK    : "#C9BAA5",
        background:  selected ? TAN       : "hsl(35 25% 92%)",
        boxShadow:   selected ? `3px 3px 0px 0px ${TAN_DK}` : "none",
      }}
    >
      {best && (
        <span
          className="absolute top-0 right-0 text-[8px] font-bold uppercase tracking-tight px-1.5 py-0.5 rounded-bl-lg"
          style={{ background: NAVY, color: CREAM }}
        >
          BEST ★ VALUE
        </span>
      )}
      <div className="px-2.5 pt-3 pb-2.5 flex flex-col gap-1">
        <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: `${NAVY}99` }}>{label}</p>
        <p className="font-display font-bold text-[1.3rem] leading-none" style={{ color: NAVY }}>{price}</p>
        <p className="text-[9px] font-semibold" style={{ color: `${NAVY}88` }}>{period}</p>
        <ul className="flex flex-col gap-0.5 mt-1.5">
          {notes.map((n) => (
            <li key={n} className="flex items-center gap-1">
              <Check className="w-2.5 h-2.5 shrink-0" strokeWidth={3} style={{ color: TAN_DK }} />
              <span className="text-[8.5px] font-semibold leading-tight" style={{ color: `${NAVY}88` }}>{n}</span>
            </li>
          ))}
        </ul>
      </div>
    </button>
  );
}

// ── Sheet ─────────────────────────────────────────────────────────────────────

const PRIVACY_URL = "https://app.notion.com/p/My-Digital-Collection-Privacy-Policy-39682db6065380b19dedcb108d4a0ef4?source=copy_link";
const TERMS_URL   = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

function openUrl(url: string) {
  window.open(url, "_system");
}

export function UpgradeSheet({ reason, onClose }: Props) {
  const { offerings, purchase, restore, isRestoring,
          isOfferingsLoading, offeringsError, refetchOfferings } = useSubscription();
  const [selected, setSelected] = useState<TierId>("lifetime");
  const [status,   setStatus]   = useState<"idle" | "pending">("idle");
  const [error,    setError]    = useState<string | null>(null);

  const prices: Record<TierId, string> = {
    monthly:  getLivePrice(offerings, "$rc_monthly",  "$1.99"),
    yearly:   getLivePrice(offerings, "$rc_annual",   "$19.99"),
    lifetime: getLivePrice(offerings, "$rc_lifetime", "$9.99"),
  };

  const ctaLabel =
    status === "pending"        ? "Opening…"
    : isOfferingsLoading        ? "Loading…"
    : selected === "lifetime"   ? `UNLOCK FOREVER – ${prices.lifetime} ›`
    : selected === "yearly"     ? `SUBSCRIBE – ${prices.yearly}/YR ›`
    :                             `SUBSCRIBE – ${prices.monthly}/MO ›`;

  const ctaDisabled = status === "pending" || isOfferingsLoading;

  const handlePurchase = useCallback(async () => {
    if (ctaDisabled) return;
    setError(null);
    if (!Capacitor.isNativePlatform()) {
      setError("Purchases are only available in the iOS app.");
      return;
    }
    setStatus("pending");
    const pkg = getRcPackage(offerings, TIER_DEFAULTS[selected].pkgId);
    if (!pkg) {
      setStatus("idle");
      setError("Products could not be loaded. Please close and try again.");
      return;
    }
    try {
      await purchase(pkg);
      onClose();
    } catch (err: unknown) {
      setStatus("idle");
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      if (msg.includes("cancel") || msg.includes("dismiss")) return;
      console.error("Purchase error:", err);
      setError("Something went wrong. Please try again.");
    }
  }, [ctaDisabled, offerings, selected, purchase, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[80] flex flex-col max-w-md mx-auto overflow-hidden"
      style={{ background: "#F2EAD8" }}
    >
      {/* ── Plaid hero header ── */}
      <div style={{ background: PLAID_BG, flexShrink: 0 }}>
        {/* Close button row */}
        <div className="flex justify-end px-4"
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top))", paddingBottom: "0.5rem" }}>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all
                       active:translate-y-0.5 active:translate-x-0.5"
            style={{
              borderColor: TAN_DK,
              background: `${NAVY}dd`,
              boxShadow: `2px 2px 0px 0px ${TAN_DK}`,
            }}
          >
            <X className="w-4 h-4" style={{ color: CREAM }} />
          </button>
        </div>

        {/* Headline */}
        <div className="px-5 pb-5">
          <h1
            className="font-display font-bold text-[2.1rem] uppercase tracking-tight leading-[0.88]"
            style={{ color: CREAM }}
          >
            {HEADLINES[reason]}
          </h1>
          <p className="text-xs font-semibold mt-1.5" style={{ color: `${CREAM}99`, whiteSpace: "pre-line" }}>
            {SUBTITLES[reason]}
          </p>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 min-h-0 flex flex-col justify-between px-5 pt-4 pb-2">

        {/* Features card */}
        <div
          className="rounded-2xl border-[3px] overflow-hidden"
          style={{ background: TAN, borderColor: TAN_DK, borderWidth: 2 }}
        >
          <div className="px-4 py-3 flex flex-col gap-1.5">
            <p className="font-display font-bold uppercase text-[1.2rem] leading-[0.95] tracking-tight"
               style={{ color: NAVY }}>
              Unlimited book collections
            </p>
            <p className="font-display font-bold uppercase text-[1.2rem] leading-[0.95] tracking-tight"
               style={{ color: NAVY }}>
              Unlimited saved lists
            </p>
            <p className="text-xs font-medium mt-1 leading-snug" style={{ color: `${NAVY}88` }}>
              Your entire library, beautifully organized — forever.
            </p>
          </div>
        </div>

        {/* Plan selector */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-center mb-1.5"
             style={{ color: TAN_DK }}>
            Choose Your Plan
          </p>
          <div className="flex gap-2">
            {TIER_ORDER.map((id) => {
              const t = TIER_DEFAULTS[id];
              return (
                <TierCard
                  key={id}
                  id={id}
                  selected={selected === id}
                  onSelect={setSelected}
                  label={t.label}
                  price={prices[id]}
                  period={t.period}
                  notes={t.notes}
                  best={t.best}
                />
              );
            })}
          </div>
        </div>

      </div>

      {/* ── CTA footer ── */}
      <div
        className="px-5 pt-2 flex flex-col gap-2 flex-shrink-0"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        {/* Offerings failed to load — show retry instead of the error string */}
        {offeringsError && !isOfferingsLoading && (
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <p className="text-xs font-semibold text-amber-700">Couldn't load products.</p>
            <button
              onClick={() => refetchOfferings()}
              className="text-xs font-bold underline text-amber-700 ml-2"
            >Try again</button>
          </div>
        )}
        {error && (
          <p className="text-xs font-semibold text-red-600 text-center px-2 -mb-1">
            {error}
          </p>
        )}
        <button
          onClick={handlePurchase}
          disabled={ctaDisabled}
          className="w-full py-3.5 rounded-2xl font-display font-bold text-lg uppercase
                     tracking-tight border-[3px] transition-all
                     active:translate-x-0.5 active:translate-y-0.5
                     disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background:  TAN,
            borderColor: TAN_DK,
            color:       NAVY,
            boxShadow:   ctaDisabled ? "none" : `4px 4px 0px 0px ${TAN_DK}`,
          }}
        >
          {ctaLabel}
        </button>
        <button
          onClick={onClose}
          className="text-sm font-semibold text-center transition-colors"
          style={{ color: TAN_DK }}
        >
          Maybe Later
        </button>
        <button
          onClick={() => restore()}
          disabled={isRestoring}
          className="text-xs font-semibold text-center transition-colors disabled:opacity-50"
          style={{ color: TAN_DK }}
        >
          {isRestoring ? "Restoring…" : "Restore Purchases"}
        </button>
        <p className="text-[10px] text-center leading-relaxed" style={{ color: TAN_DK }}>
          <button
            onClick={() => openUrl(TERMS_URL)}
            className="underline underline-offset-2 transition-colors"
          >
            Terms of Use
          </button>
          {"  ·  "}
          <button
            onClick={() => openUrl(PRIVACY_URL)}
            className="underline underline-offset-2 transition-colors"
          >
            Privacy Policy
          </button>
        </p>
      </div>
    </motion.div>
  );
}
