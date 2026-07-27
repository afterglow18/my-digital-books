/**
 * WelcomePage — Full-screen library hero splash.
 *
 * IDLE    : library image fills the screen, button pulses at bottom.
 * EXITING : whole screen fades out → onEnter().
 */

import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";

interface Props { onEnter: () => void; }

export default function WelcomePage({ onEnter }: Props) {
  const [exiting, setExiting] = useState(false);
  const calledRef = useRef(false);

  const finish = useCallback(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    onEnter();
  }, [onEnter]);

  const handleOpen = () => {
    if (exiting) return;
    setExiting(true);
    setTimeout(finish, 600);
  };

  return (
    <motion.div
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: 0.6, ease: "easeIn" }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        overflow: "hidden",
        background: "#1A0E04",
      }}
    >
      {/* ── Hero image — fills the screen ── */}
      <img
        src="/welcome-hero.png"
        alt="My Digital Books"
        draggable={false}
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "fill",
          userSelect: "none",
          pointerEvents: "none",
        }}
      />

      {/* ── Bottom gradient so the button reads clearly ── */}
      <div
        style={{
          position: "absolute",
          bottom: 0, left: 0, right: 0,
          height: "28%",
          background: "linear-gradient(to top, rgba(14,7,2,0.82) 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ── Button + footer — pinned to bottom, always centered ── */}
      <motion.div
        animate={exiting ? { opacity: 0, y: 10 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        style={{
          position: "absolute",
          bottom: 0, left: 0, right: 0,
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: 8,
          paddingBottom: "calc(env(safe-area-inset-bottom) + 14px)",
          paddingTop: 20,
          pointerEvents: exiting ? "none" : "auto",
        }}
      >
        <button
          onClick={handleOpen}
          style={{
            fontFamily: "var(--font-display, sans-serif)",
            fontWeight: 800,
            fontSize: 15,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "#3A2210",
            background: "linear-gradient(to bottom, #E8D4B0, #B8894E)",
            border: "2px solid #8A5A28",
            borderRadius: 100,
            padding: "14px 44px",
            cursor: "pointer",
            whiteSpace: "nowrap",
            boxShadow: "0 4px 24px rgba(120,80,40,0.50), 0 2px 0 rgba(0,0,0,0.6)",
          }}
        >
          Open Books ✨
        </button>

        <div style={{ display: "flex", gap: 16 }}>
          <a
            href="https://classy-alpaca-441.notion.site/Privacy-Policy-39682db6065380b19dedcb108d4a0ef4"
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.35)", textDecoration: "none", letterSpacing: "0.02em" }}
          >Privacy Policy</a>
          <a
            href="https://app.notion.com/p/My-Digital-Closet-Support-39782db60653802a9088dcbae84c0527?source=copy_link"
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.35)", textDecoration: "none", letterSpacing: "0.02em" }}
          >Support</a>
        </div>
      </motion.div>
    </motion.div>
  );
}
