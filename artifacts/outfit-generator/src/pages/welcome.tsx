/**
 * WelcomePage — Brown suitcase splash screen.
 *
 * IDLE     : brown suitcase closed on a dark background, title + button below.
 * OPENING  : lid rotates open (3-D perspective flip), warm light floods from inside.
 * GLOWING  : warm radial glow fills the screen.
 * EXITING  : whole screen fades to transparent → onEnter().
 */

import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";

// ── Suitcase dimensions (px, will scale via container) ──────────────────────
const SW  = 280;   // suitcase width
const SH  = 196;   // suitcase total height
const LH  = 88;    // lid height (top portion)
const BH  = SH - LH; // body height (bottom portion)

// ── Page ──────────────────────────────────────────────────────────────────────
interface Props { onEnter: () => void; }

export default function WelcomePage({ onEnter }: Props) {
  const [phase, setPhase] = useState<"idle" | "opening" | "glowing" | "exiting">("idle");
  const calledRef = useRef(false);

  const finish = useCallback(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    onEnter();
  }, [onEnter]);

  const handleOpen = () => {
    if (phase !== "idle") return;
    setPhase("opening");
    // lid fully open → flood screen with warmth
    setTimeout(() => setPhase("glowing"),  950);
    // begin fade-out
    setTimeout(() => setPhase("exiting"), 1500);
    // fire route change
    setTimeout(finish, 2150);
  };

  const isOpen   = phase !== "idle";
  const isGlow   = phase === "glowing" || phase === "exiting";

  return (
    <motion.div
      animate={{ opacity: phase === "exiting" ? 0 : 1 }}
      transition={{ duration: 0.65, ease: "easeIn" }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}
    >
      {/* ── Animated background: dark brown → warm tan on open ── */}
      <motion.div
        style={{ position: "absolute", inset: 0 }}
        animate={{
          background: isGlow
            ? "radial-gradient(ellipse 80% 60% at 50% 42%, #D4A464 0%, #8B5E3C 40%, #3A2010 100%)"
            : isOpen
              ? "radial-gradient(ellipse 60% 40% at 50% 42%, #7B4F2E 0%, #2C1608 60%, #0E0804 100%)"
              : "#0E0804",
        }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />

      {/* ── Main content ── */}
      <div style={{
        position: "relative", zIndex: 2,
        display: "flex", flexDirection: "column", alignItems: "center",
      }}>

        {/* ── Handle ── */}
        <div style={{
          width: 62, height: 26,
          borderRadius: "31px 31px 0 0",
          border: "5px solid #7B5030",
          borderBottom: "none",
          background: "transparent",
          marginBottom: -3,
          position: "relative", zIndex: 2,
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.35)",
        }} />

        {/* ── Suitcase wrapper — provides perspective for lid flip ── */}
        <div style={{
          width: SW, height: SH,
          position: "relative",
          perspective: 700,
        }}>

          {/* Inner warm glow (behind lid, z below lid) */}
          <motion.div
            style={{
              position: "absolute", top: 0, left: 6, right: 6, height: LH + 4,
              borderRadius: "10px 10px 0 0",
              zIndex: 3,
              background: "radial-gradient(ellipse at 50% 100%, rgba(255,210,100,1) 0%, rgba(230,150,50,0.8) 50%, transparent 100%)",
              filter: "blur(4px)",
            }}
            animate={{ opacity: isOpen ? 1 : 0 }}
            transition={{ duration: 0.35, delay: isOpen ? 0.35 : 0 }}
          />

          {/* ── LID — rotates open ── */}
          <motion.div
            style={{
              position: "absolute", top: 0, left: 0, right: 0,
              height: LH,
              borderRadius: "12px 12px 0 0",
              border: "2.5px solid #2A1408",
              borderBottom: "1.5px solid #4A2E14",
              transformOrigin: "top center",
              zIndex: 5,
              overflow: "hidden",
              background: "linear-gradient(160deg, #9B6A42 0%, #6B4020 55%, #8B5830 100%)",
              boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.3), inset 0 3px 8px rgba(255,255,255,0.06)",
            }}
            animate={isOpen
              ? { rotateX: -172, opacity: [1, 1, 1, 0.6, 0] }
              : { rotateX: 0,    opacity: 1 }
            }
            transition={{ duration: 0.9, ease: [0.3, 0, 0.15, 1] }}
          >
            {/* Lid stitching */}
            <div style={{ position: "absolute", top: 10, left: 16, right: 16, height: 1, background: "rgba(255,255,255,0.08)", borderRadius: 1 }} />
            <div style={{ position: "absolute", top: 14, left: 16, right: 16, height: 1, background: "rgba(255,255,255,0.04)", borderRadius: 1 }} />
            {/* Subtle sheen */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: "35%",
              background: "linear-gradient(to bottom, rgba(255,255,255,0.09), transparent)",
              borderRadius: "10px 10px 0 0",
            }} />
          </motion.div>

          {/* ── SEAM + CLASPS (always visible, sits between lid and body) ── */}
          <div style={{
            position: "absolute", top: LH - 7, left: 0, right: 0,
            height: 14,
            background: "#1C0A04",
            zIndex: 6,
            display: "flex", alignItems: "center",
          }}>
            {/* Left clasp */}
            <div style={{
              position: "absolute", left: "26%",
              transform: "translateX(-50%)",
              width: 20, height: 11,
              background: "linear-gradient(to bottom, #F0D060, #A07828)",
              borderRadius: 3,
              border: "1px solid #7A5818",
              boxShadow: "0 1px 3px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.25)",
            }} />
            {/* Right clasp */}
            <div style={{
              position: "absolute", left: "74%",
              transform: "translateX(-50%)",
              width: 20, height: 11,
              background: "linear-gradient(to bottom, #F0D060, #A07828)",
              borderRadius: 3,
              border: "1px solid #7A5818",
              boxShadow: "0 1px 3px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.25)",
            }} />
          </div>

          {/* ── BODY ── */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            height: BH,
            borderRadius: "0 0 12px 12px",
            border: "2.5px solid #2A1408",
            borderTop: "none",
            background: "linear-gradient(to bottom, #6B4020 0%, #9B6A42 100%)",
            boxShadow: "inset 0 3px 8px rgba(0,0,0,0.25), inset 0 -2px 6px rgba(255,255,255,0.04)",
            overflow: "hidden",
          }}>
            {/* Body stitching */}
            <div style={{ position: "absolute", bottom: 14, left: 16, right: 16, height: 1, background: "rgba(255,255,255,0.06)", borderRadius: 1 }} />
            <div style={{ position: "absolute", bottom: 10, left: 16, right: 16, height: 1, background: "rgba(255,255,255,0.03)", borderRadius: 1 }} />
            {/* Side rivets */}
            {[14, SW - 14].map((x) => (
              <div key={x} style={{
                position: "absolute",
                left: x === 14 ? 8 : undefined,
                right: x !== 14 ? 8 : undefined,
                top: "50%", transform: "translateY(-50%)",
                width: 7, height: 7,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #D4A850, #7A5020)",
                border: "1px solid #5A3A10",
              }} />
            ))}
          </div>

          {/* ── Wheels ── */}
          {[28, SW - 28].map((x, i) => (
            <div key={i} style={{
              position: "absolute", bottom: -9, left: x,
              transform: "translateX(-50%)",
              width: 16, height: 10,
              borderRadius: "0 0 8px 8px",
              background: "#1C0A04",
              border: "1.5px solid #0A0402",
            }}>
              <div style={{
                position: "absolute", top: 2, left: "50%",
                transform: "translateX(-50%)",
                width: 8, height: 6,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.08)",
              }} />
            </div>
          ))}
        </div>

        {/* ── Title ── */}
        <motion.div
          style={{ marginTop: 44, textAlign: "center" }}
          animate={{ opacity: isGlow ? 0 : 1 }}
          transition={{ duration: 0.35 }}
        >
          <div style={{
            fontFamily: "var(--font-display, serif)",
            fontWeight: 900,
            fontSize: "clamp(28px, 8vw, 42px)",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            color: "#E8D4B0",
          }}>
            MY DIGITAL<br />SUITCASE
          </div>
          <div style={{
            marginTop: 9,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.25em",
            textTransform: "uppercase" as const,
            color: "rgba(232,212,176,0.42)",
          }}>
            your travel collection
          </div>
        </motion.div>

        {/* ── "Open Suitcase" button ── */}
        <motion.button
          onClick={handleOpen}
          animate={{
            opacity: phase === "idle" ? 1 : 0,
            y:       phase === "idle" ? 0 : 8,
            pointerEvents: phase === "idle" ? "auto" : "none",
          }}
          transition={{ duration: 0.2 }}
          style={{
            marginTop: 36,
            fontFamily: "var(--font-display, sans-serif)",
            fontWeight: 800,
            fontSize: 15,
            letterSpacing: "0.03em",
            color: "#3A2210",
            background: "linear-gradient(to bottom, #E8D4B0, #B8894E)",
            border: "1.5px solid #B8894E",
            borderRadius: 100,
            padding: "13px 40px",
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(120,80,40,0.45), 2px 2px 0 rgba(0,0,0,0.7)",
            whiteSpace: "nowrap",
          }}
        >
          Open Suitcase ✨
        </motion.button>
      </div>

      {/* ── Footer links ── */}
      <div
        style={{
          position: "fixed",
          bottom: "calc(env(safe-area-inset-bottom) + 10px)",
          left: 0, right: 0,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          zIndex: 210,
        }}
      >
        <a
          href="https://classy-alpaca-441.notion.site/Privacy-Policy-39682db6065380b19dedcb108d4a0ef4"
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.25)", textDecoration: "none", letterSpacing: "0.02em" }}
        >
          Privacy Policy
        </a>
        <a
          href="https://app.notion.com/p/My-Digital-Closet-Support-39782db60653802a9088dcbae84c0527?source=copy_link"
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.25)", textDecoration: "none", letterSpacing: "0.02em" }}
        >
          Support
        </a>
      </div>
    </motion.div>
  );
}
