/**
 * Settings / Account page
 * Visual: deep midnight navy (#060E1F) accents, rich tan/gold text & buttons.
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Upload, RefreshCw, Loader2, Check, AlertTriangle, ShieldCheck } from "lucide-react";
import { exportBackup, importBackup, pickBackupFile } from "@/lib/backup";
import { useSubscription } from "@/lib/revenuecat";
import { useQueryClient } from "@tanstack/react-query";
import { UpgradeSheet } from "@/components/paywall/UpgradeSheet";
import {
  getListClothingQueryKey,
  getListOutfitsQueryKey,
  getWardrobeStatsQueryKey,
} from "@/hooks/useLocalDB";
import { Capacitor } from "@capacitor/core";
import { useBiometricLock } from "@/context/BiometricLockContext";

// ── Palette ───────────────────────────────────────────────────────────────────
const NAVY  = "#0D1B38";
const GOLD  = "#C4A07A";
const CREAM = "#F5EAD4";
const TAN   = "#C4A07A";

// ─── Card shell ───────────────────────────────────────────────────────────────

function Card({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: `3px solid ${NAVY}`, background: "#FFFDF8" }}
    >
      {/* Header row */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ background: NAVY, borderBottom: `3px solid ${NAVY}` }}
      >
        <span className="text-xl leading-none">{emoji}</span>
        <h2
          className="font-display font-bold text-base uppercase tracking-tight"
          style={{ color: CREAM }}
        >
          {title}
        </h2>
      </div>
      <div className="p-4 flex flex-col gap-3">{children}</div>
    </div>
  );
}

// ─── Navy action button ───────────────────────────────────────────────────────

function NavyButton({
  onClick,
  pending,
  icon: Icon,
  label,
}: {
  onClick: () => void;
  pending?: boolean;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!!pending}
      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl
                 font-display font-bold text-sm uppercase tracking-tight
                 active:translate-x-0.5 active:translate-y-0.5 transition-all
                 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background:  NAVY,
        border:      `3px solid ${NAVY}`,
        color:       CREAM,
        boxShadow:   `3px 3px 0px 0px ${GOLD}`,
      }}
    >
      {pending ? (
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: GOLD }} />
      ) : (
        <Icon className="w-4 h-4" style={{ color: GOLD }} />
      )}
      {label}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccountPage() {
  const qc = useQueryClient();
  const { isSubscribed, restore, isRestoring } = useSubscription();

  const [showUpgrade, setShowUpgrade] = useState(false);
  const { isLockEnabled, setLockEnabled } = useBiometricLock();
  const [lockPending, setLockPending] = useState(false);
  const showBiometricToggle = Capacitor.isNativePlatform();

  const handleLockToggle = async () => {
    setLockPending(true);
    await setLockEnabled(!isLockEnabled);
    setLockPending(false);
  };

  const [exportPending, setExportPending] = useState(false);
  const [importPending, setImportPending] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const flash = (type: "success" | "error", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4500);
  };

  const handleExport = async () => {
    setExportPending(true);
    try {
      await exportBackup();
      flash("success", "Backup exported — save it to Files or iCloud Drive.");
    } catch (err) {
      flash("error", err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportPending(false);
    }
  };

  const handleImport = async () => {
    setImportPending(true);
    try {
      const json = await pickBackupFile();
      const result = await importBackup(json);
      await qc.invalidateQueries({ queryKey: getListClothingQueryKey() });
      await qc.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
      await qc.invalidateQueries({ queryKey: getWardrobeStatsQueryKey() });
      flash(
        "success",
        `Restored ${result.clothingAdded} items and ${result.outfitsAdded} outfits.` +
          (result.skippedItems > 0 ? ` (${result.skippedItems} skipped — already exist.)` : ""),
      );
    } catch (err) {
      flash("error", err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportPending(false);
    }
  };

  const handleRestore = async () => {
    try {
      await restore();
    } catch (err) {
      flash("error", err instanceof Error ? err.message : "Could not restore");
    }
  };

  return (
    <>
    <div
      className="min-h-full flex flex-col px-4 pb-10"
      style={{ paddingTop: "max(2rem, env(safe-area-inset-top))", background: "#F2EAD8" }}
    >
      {/* Page title */}
      <header className="mb-5">
        <h1
          className="font-display font-bold text-4xl uppercase tracking-tighter leading-none"
          style={{ color: NAVY }}
        >
          My Digital<br />Books
        </h1>
      </header>

      {/* Flash message */}
      <AnimatePresence>
        {msg && (
          <motion.div
            key="msg"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-4 px-4 py-3 rounded-xl text-sm font-medium flex items-start gap-2"
            style={{
              border: `2px solid ${NAVY}`,
              background: msg.type === "success" ? "#E8EEF8" : "#FFF3E0",
              color: msg.type === "success" ? "#0D1B38" : "#7A3A00",
            }}
          >
            {msg.type === "success"
              ? <Check className="w-4 h-4 shrink-0 mt-0.5" />
              : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
            {msg.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-4 md:max-w-2xl md:mx-auto">

        {/* ── 1. MY PLAN ──────────────────────────────────────────────────── */}
        <Card emoji="👑" title="My Plan">
          {/* Current plan row */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: `${NAVY}99` }}>Current plan</span>
            <span
              className="text-sm font-bold px-3 py-0.5 rounded-full"
              style={{
                border: `2px solid ${NAVY}`,
                background: isSubscribed ? GOLD : "transparent",
                color: isSubscribed ? NAVY : NAVY,
              }}
            >
              {isSubscribed ? "Pro" : "Free"}
            </span>
          </div>

          {isSubscribed ? (
            <div
              className="flex items-center gap-2 text-sm font-semibold rounded-lg px-3 py-2"
              style={{ background: "#E8EEF8", color: "#0D1B38", border: "1px solid #8FA8D4" }}
            >
              <Check className="w-4 h-4 shrink-0" />
              Pro active — unlimited everything
            </div>
          ) : (
            <NavyButton
              onClick={() => setShowUpgrade(true)}
              icon={() => null}
              label="Lifetime Unlock — $9.99"
            />
          )}

          {/* Restore link */}
          <button
            onClick={handleRestore}
            disabled={isRestoring}
            className="flex items-center justify-center gap-1.5 text-sm font-medium transition-colors mx-auto"
            style={{ color: TAN }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {isRestoring ? "Restoring…" : "Restore Purchases"}
          </button>
        </Card>

        {/* ── 2. PRIVACY & SECURITY ───────────────────────────────────────── */}
        {showBiometricToggle && (
          <Card emoji="🔒" title="Privacy & Security">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <ShieldCheck className="w-5 h-5 shrink-0" style={{ color: TAN }} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight" style={{ color: NAVY }}>
                    Lock with Face ID / Touch ID
                  </p>
                  <p className="text-xs leading-snug mt-0.5" style={{ color: `${NAVY}66` }}>
                    Require biometrics when opening the app or returning from background.
                  </p>
                </div>
              </div>

              {/* Toggle */}
              <button
                role="switch"
                aria-checked={isLockEnabled}
                onClick={handleLockToggle}
                disabled={lockPending}
                className="shrink-0 relative w-12 h-7 rounded-full transition-all disabled:opacity-50"
                style={{
                  border: `2.5px solid ${NAVY}`,
                  background: isLockEnabled ? NAVY : "#D9CFC3",
                  boxShadow: `2px 2px 0px 0px ${GOLD}`,
                }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full transition-all duration-200"
                  style={{
                    border: `2px solid ${NAVY}`,
                    background: isLockEnabled ? GOLD : CREAM,
                    left: isLockEnabled ? "calc(100% - 1.375rem)" : "0.125rem",
                  }}
                />
              </button>
            </div>
          </Card>
        )}

        {/* ── 3. BACKUP & RESTORE ─────────────────────────────────────────── */}
        <Card emoji="💾" title="Backup & Restore">
          <p className="text-sm leading-snug" style={{ color: `${NAVY}88` }}>
            Export your library to a file. Save it to iCloud Drive or Files to
            keep it safe across phone upgrades.
          </p>

          <NavyButton
            onClick={handleExport}
            pending={exportPending}
            icon={Download}
            label="Export Backup"
          />

          {/* Warning */}
          <p className="text-sm font-bold leading-snug" style={{ color: "#C0390B" }}>
            ⚠️ Deleting the app removes all your library data.
            Export a backup first to keep it safe.
          </p>

          <NavyButton
            onClick={handleImport}
            pending={importPending}
            icon={Upload}
            label="Import Backup"
          />

          <p className="text-xs text-center leading-snug" style={{ color: `${NAVY}55` }}>
            Importing replaces your current library with the backup.
          </p>
        </Card>

        {/* ── 4. APP INFO ─────────────────────────────────────────────────── */}
        <Card emoji="📚" title="My Digital Books">
          <p className="text-sm leading-snug" style={{ color: `${NAVY}88` }}>
            Version 1.0.0
          </p>
          <p className="text-sm leading-snug" style={{ color: `${NAVY}88` }}>
            Your library stays on your device, works offline, and can be
            backed up with iCloud.
          </p>
        </Card>

      </div>
    </div>

    <AnimatePresence>
      {showUpgrade && (
        <UpgradeSheet reason="items" onClose={() => setShowUpgrade(false)} />
      )}
    </AnimatePresence>
    </>
  );
}
