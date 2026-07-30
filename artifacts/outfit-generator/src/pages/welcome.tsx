/**
 * WelcomePage — Three-phase splash shown once per cold launch.
 *
 * Phase 1 (hero):     Full-screen hero image + branding, auto-advances after 2.5 s
 * Phase 2 (idle):     Leather book animation + branding + "Open Books" button
 * Phase 3 (tap):      Cover flips → hero expands → screen fades → onEnter()
 *   opening   → cover flips back (0.75 s)
 *   revealing → full-screen hero scales up from book (0.55 s)
 *   exiting   → screen fades out (0.55 s) → onEnter()
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props { onEnter: () => void; }

export default function WelcomePage({ onEnter }: Props) {
  const [phase, setPhase] = useState<"hero" | "idle" | "opening" | "revealing" | "exiting">("hero");
  const [vw, setVw] = useState(375);
  const [vh, setVh] = useState(700);
  const calledRef = useRef(false);
  const timers    = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const update = () => { setVw(window.innerWidth); setVh(window.innerHeight); };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Phase 1 auto-advance: hero → idle after 2.5 s
  useEffect(() => {
    const t = setTimeout(() => setPhase("idle"), 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const finish = useCallback(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    onEnter();
  }, [onEnter]);

  const handleOpen = () => {
    if (phase !== "idle") return;
    setPhase("opening");
    // Skip "revealing" (hero re-expand) — go straight from cover flip → fade out → app
    const t1 = setTimeout(() => setPhase("exiting"), 750);
    const t2 = setTimeout(finish,                    1300);
    timers.current = [t1, t2];
  };

  // ── Book dimensions ──────────────────────────────────────────────────────
  const SW  = Math.min(vw * 0.62, 250);   // book width
  const SH  = SW  * 1.38;                 // book height

  const isOpen   = phase !== "idle" && phase !== "hero";
  const isReveal = phase === "revealing" || phase === "exiting";

  return (
    <motion.div
      animate={{ opacity: phase === "exiting" ? 0 : 1 }}
      transition={{ duration: 0.55, ease: "easeIn" }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        overflow: "hidden",
        background: "#0E0804",
      }}
    >
      {/* ── Full-screen hero — expands during revealing ───────────────────── */}
      <motion.img
        src="/welcome-hero.png"
        alt=""
        draggable={false}
        animate={isReveal ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.26 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: "absolute",
          top: "env(safe-area-inset-top)", left: 0, right: 0, bottom: 0,
          width: "100%",
          height: "calc(100% - env(safe-area-inset-top))",
          objectFit: "fill",
          zIndex: 8,
          pointerEvents: "none",
          userSelect: "none",
        }}
      />

      {/* ── Phase 1 hero overlay — shown for 2.5 s then fades out ─────────── */}
      <AnimatePresence>
        {phase === "hero" && (
          <motion.div
            key="hero-phase"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: "easeIn" }}
            style={{
              position: "absolute", inset: 0, zIndex: 16,
              overflow: "hidden",
            }}
          >
            {/* Full-cover hero image */}
            <img
              src="/welcome-hero.png"
              alt=""
              draggable={false}
              style={{
                width: "100%", height: "100%",
                objectFit: "cover", objectPosition: "center top",
                display: "block", userSelect: "none",
              }}
            />
            {/* Dark gradient for readability */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              height: "52%",
              background: "linear-gradient(to bottom, transparent, rgba(8,4,1,0.92))",
              pointerEvents: "none",
            }} />
            {/* Branding text */}
            <div style={{
              position: "absolute",
              bottom: `calc(env(safe-area-inset-bottom, 0px) + ${Math.round(vh * 0.11)}px)`,
              left: 0, right: 0,
              textAlign: "center",
              padding: "0 28px",
              pointerEvents: "none",
            }}>
              <div style={{
                fontSize: 11, fontWeight: 600,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "rgba(232,212,176,0.60)",
                marginBottom: 7,
                fontFamily: "var(--font-display, sans-serif)",
              }}>
                Welcome to
              </div>
              <div style={{
                fontFamily: "var(--font-display, serif)",
                fontWeight: 900,
                fontSize: `clamp(26px, ${Math.round(vw * 0.095)}px, 42px)`,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                lineHeight: 1.08,
                color: "#E8D4B0",
                textShadow: "0 2px 18px rgba(0,0,0,0.65)",
              }}>
                MY DIGITAL<br />BOOKS
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Book + title + button (fades out when hero takes over) ─────────── */}
      <motion.div
        animate={{ opacity: isReveal ? 0 : 1, y: isReveal ? -12 : 0 }}
        transition={{ duration: 0.25 }}
        style={{
          position: "relative", zIndex: 4,
          display: "flex", flexDirection: "column", alignItems: "center",
        }}
      >

        {/* ══ THE BOOK ══════════════════════════════════════════════════════ */}
        <div style={{ width: SW, height: SH, position: "relative", perspective: SW * 3.2 }}>

          {/* Back cover + page edges (always visible behind the front cover) */}
          <div style={{
            position: "absolute", inset: 0,
            borderRadius: "4px 10px 10px 4px",
            background: "#2E1508",
            boxShadow: `6px 8px 32px rgba(0,0,0,0.75), inset -2px 0 0 rgba(0,0,0,0.3)`,
          }}>
            {/* Stacked page edges on right */}
            <div style={{
              position: "absolute", right: 0, top: SW * 0.025, bottom: SW * 0.025,
              width: SW * 0.04, borderRadius: "0 6px 6px 0",
              background: "repeating-linear-gradient(to bottom, #F0E4C8, #D4C4A0 1.5px, #F0E4C8 1.5px, #F0E4C8 4px)",
            }} />

            {/* Hero image inside the book — revealed as cover flips */}
            <motion.img
              src="/welcome-hero.png"
              alt=""
              draggable={false}
              animate={{ opacity: isOpen && !isReveal ? 1 : 0 }}
              transition={{ duration: 0.35, delay: isOpen ? 0.30 : 0 }}
              style={{
                position: "absolute",
                left: SW * 0.045, right: SW * 0.06,
                top: SH * 0.015, bottom: SH * 0.015,
                objectFit: "cover",
                borderRadius: 3,
                pointerEvents: "none",
              }}
            />
          </div>

          {/* Front cover — 3-D flip on Y axis around spine (left edge) */}
          <motion.div
            animate={isOpen ? { rotateY: -168 } : { rotateY: 0 }}
            transition={{ duration: 0.80, ease: [0.30, 0, 0.15, 1] }}
            style={{
              position: "absolute", inset: 0,
              transformOrigin: "left center",
              transformStyle: "preserve-3d",
            }}
          >
            {/* Front face of cover */}
            <div style={{
              position: "absolute", inset: 0,
              backfaceVisibility: "hidden",
              borderRadius: "4px 10px 10px 4px",
              background: "linear-gradient(150deg, #8B4A1E 0%, #5C2E0A 38%, #7A3E14 68%, #4A2008 100%)",
              boxShadow: `inset 0 0 ${SW * 0.07}px rgba(0,0,0,0.45)`,
              overflow: "hidden",
            }}>
              {/* Spine left strip */}
              <div style={{
                position: "absolute", left: 0, top: 0, bottom: 0,
                width: SW * 0.10,
                background: "linear-gradient(to right, #2E1206, #5C2E0A)",
              }} />
              {/* Spine shadow divider */}
              <div style={{
                position: "absolute", left: SW * 0.10, top: 0, bottom: 0,
                width: 2, background: "rgba(0,0,0,0.40)",
              }} />

              {/* Gold outer border */}
              <div style={{
                position: "absolute",
                top: SH * 0.048, left: SW * 0.145,
                right: SW * 0.048, bottom: SH * 0.048,
                border: "1.5px solid rgba(212,175,55,0.60)",
                borderRadius: 5,
              }} />
              {/* Gold inner border */}
              <div style={{
                position: "absolute",
                top: SH * 0.066, left: SW * 0.162,
                right: SW * 0.066, bottom: SH * 0.066,
                border: "0.5px solid rgba(212,175,55,0.28)",
                borderRadius: 3,
              }} />

              {/* "Welcome" in cursive — centrepiece of the cover */}
              <div style={{
                position: "absolute",
                top: 0, bottom: 0, left: SW * 0.14, right: SW * 0.05,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: SH * 0.04,
              }}>
                {/* Top flourish */}
                <div style={{
                  fontSize: SW * 0.065,
                  color: "rgba(212,175,55,0.50)",
                  letterSpacing: "0.10em",
                }}>✦ ─── ✦</div>

                {/* Welcome */}
                <div style={{
                  fontFamily: "'Dancing Script', 'Brush Script MT', 'Segoe Script', cursive",
                  fontWeight: 700,
                  fontSize: SW * 0.22,
                  lineHeight: 1.1,
                  color: "#1B2B4B",
                  WebkitTextStroke: `${SW * 0.006}px #D4AF37`,
                  textShadow: "0 2px 8px rgba(0,0,0,0.40)",
                  textAlign: "center",
                }}>
                  Welcome
                </div>

                {/* Bottom flourish */}
                <div style={{
                  fontSize: SW * 0.065,
                  color: "rgba(212,175,55,0.50)",
                  letterSpacing: "0.10em",
                }}>✦ ─── ✦</div>
              </div>

              {/* Sheen */}
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 55%)",
                borderRadius: "4px 10px 10px 4px",
              }} />
            </div>

            {/* Back face of cover (inside, visible mid-rotation) */}
            <div style={{
              position: "absolute", inset: 0,
              transform: "rotateY(180deg)",
              backfaceVisibility: "hidden",
              background: "#2A1206",
              borderRadius: "4px 10px 10px 4px",
            }} />
          </motion.div>
        </div>
        {/* ══ END BOOK ══════════════════════════════════════════════════════ */}

        {/* Title */}
        <div style={{ marginTop: vh * 0.038, textAlign: "center" }}>
          <div style={{
            fontSize: 11, fontWeight: 600,
            letterSpacing: "0.22em",
            textTransform: "uppercase" as const,
            color: "rgba(232,212,176,0.60)",
            marginBottom: 5,
            fontFamily: "var(--font-display, sans-serif)",
          }}>
            Welcome to
          </div>
          <div style={{
            fontFamily: "var(--font-display, serif)",
            fontWeight: 900,
            fontSize: `clamp(24px, ${SW * 0.145}px, 44px)`,
            letterSpacing: "0.08em",
            textTransform: "uppercase" as const,
            lineHeight: 1.08,
            color: "#E8D4B0",
          }}>
            MY DIGITAL<br />BOOKS
          </div>
        </div>

        {/* Open Books button */}
        <motion.button
          onClick={handleOpen}
          animate={{ opacity: phase === "idle" ? 1 : 0, y: phase === "idle" ? 0 : 8 }}
          transition={{ duration: 0.2 }}
          style={{
            marginTop: vh * 0.038,
            fontFamily: "var(--font-display, sans-serif)",
            fontWeight: 800, fontSize: 15,
            letterSpacing: "0.03em",
            color: "#0D1B38",
            background: "linear-gradient(to bottom, #E8D4B0, #C4A07A)",
            border: "1.5px solid #C4A07A",
            borderRadius: 100,
            padding: "13px 40px",
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(120,80,40,0.45), 2px 2px 0 rgba(0,0,0,0.7)",
            whiteSpace: "nowrap",
            pointerEvents: phase === "idle" ? "auto" : "none",
          }}
        >
          Open Books ✨
        </motion.button>
      </motion.div>

      {/* Footer links */}
      <div style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom) + 10px)",
        left: 0, right: 0,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        zIndex: 210,
        pointerEvents: (isReveal || phase === "hero") ? "none" : "auto",
        opacity: phase === "hero" ? 0 : 1,
        transition: "opacity 0.4s ease",
      }}>
        <a
          href="https://classy-alpaca-441.notion.site/Privacy-Policy-39682db6065380b19dedcb108d4a0ef4"
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.25)", textDecoration: "none", letterSpacing: "0.02em" }}
        >Privacy Policy</a>
        <a
          href="https://app.notion.com/p/My-Digital-Closet-Support-39782db60653802a9088dcbae84c0527?source=copy_link"
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.25)", textDecoration: "none", letterSpacing: "0.02em" }}
        >Support</a>
      </div>
    </motion.div>
  );
}
