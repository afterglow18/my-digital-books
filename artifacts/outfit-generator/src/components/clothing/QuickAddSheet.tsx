/**
 * QuickAddSheet
 *
 * Upload flow:
 *   pick ──(file chosen)──► encoding ──► preview (Original | Cleaned ✨) ──► uploading ──► close
 *
 * On-device background removal via @imgly/background-removal.
 * The ONNX model (~15 MB) downloads once from the imgly CDN then is cached permanently.
 */
import React, { useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  X,
  Loader2,
  Check,
} from "lucide-react";
import {
  useCreateClothingItem,
  getListClothingQueryKey,
  getWardrobeStatsQueryKey,
} from "@/hooks/useLocalDB";
import { useQueryClient } from "@tanstack/react-query";
import {
  removeBackground,
  blobToDataUrl,
  dataUrlToBlob,
} from "@/lib/backgroundRemoval";
import { useCategoryNames, type CategoryKey } from "@/hooks/useCategoryNames";

// ── Types ──────────────────────────────────────────────────────────────────────

type Category = "outfits" | "beauty" | "toiletries" | "essentials";

type Phase =
  | "pick"       // two-button landing screen
  | "encoding"   // full-screen spinner while canvas-encoding the photo
  | "preview"    // side-by-side Original | Cleaned comparison
  | "uploading"; // saving to DB

// ── Helpers ────────────────────────────────────────────────────────────────────

const PHOTO_TIPS = [
  "Lay everything flat on a plain background.",
  "Take the photo from directly above.",
  "Keep all items fully in frame.",
] as const;

const CATEGORY_EXAMPLES: Record<string, { emoji: string; items: string[] }> = {
  outfits:    { emoji: "📖", items: ["Novels", "Short Stories", "Poetry", "Graphic Novels", "Fantasy", "Romance", "Thriller"] },
  beauty:     { emoji: "📰", items: ["Biographies", "History", "Science", "Essays", "True Crime", "Politics"] },
  toiletries: { emoji: "🧠", items: ["Mindfulness", "Productivity", "Health", "Finance", "Relationships", "Spirituality"] },
  essentials: { emoji: "📌", items: ["Want to Read", "Gift Ideas", "Recommended", "Series to Finish", "Library Holds"] },
};

/**
 * Resize + compress a File or Blob to a JPEG ≤ 2048 px.
 * Put OUTSIDE the component so it is never re-created.
 */
async function encodeForUpload(input: File | Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(input);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX   = 2048;
      const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const w     = Math.round(img.naturalWidth  * scale);
      const h     = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (b) => (b && b.size > 1000 ? resolve(b) : reject(new Error("blank image"))),
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("failed to load image"));
    };
    img.src = objectUrl;
  });
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  category:      Category;
  existingCount: number;
  /** Called with the newly created item after a successful upload. */
  onCreated?:    (item: import("@/lib/db").ClothingItem) => void;
}

export function QuickAddSheet({ open, onOpenChange, category, existingCount, onCreated }: Props) {
  const { names } = useCategoryNames();
  const [phase,        setPhase]        = useState<Phase>("pick");
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);
  const [originalBlob, setOriginalBlob] = useState<Blob | null>(null);
  const [originalUrl,  setOriginalUrl]  = useState<string | null>(null);
  const [cleanedBlob,  setCleanedBlob]  = useState<Blob | null>(null);
  const [cleanedUrl,   setCleanedUrl]   = useState<string | null>(null);
  const [bgProcessing, setBgProcessing] = useState(false);
  const [bgFailed,     setBgFailed]     = useState(false);
  const [selected,     setSelected]     = useState<"original" | "cleaned">("original");
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

  // Each photo bumps this counter. Every async step checks it before writing state —
  // prevents a slow first photo from clobbering a fast second one.
  const bgGenRef = useRef(0);

  // Two separate file inputs: one triggers camera, one opens gallery
  const cameraInputRef  = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const createItem  = useCreateClothingItem();
  const queryClient = useQueryClient();

  // ── Reset ─────────────────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    bgGenRef.current += 1;   // cancels any in-flight removal
    setBgProcessing(false);  // MUST reset — close can happen mid-removal
    setPhase("pick");
    setErrorMsg(null);
    setOriginalBlob(null);
    setOriginalUrl(null);
    setCleanedBlob(null);
    setCleanedUrl(null);
    setBgFailed(false);
    setSelected("original");
    onOpenChange(false);
  }, [onOpenChange]);

  // ── handleFile — encode + kick off background removal ────────────────────

  const handleFile = useCallback(async (file: File | Blob) => {
    setErrorMsg(null);
    // Switch to "encoding" BEFORE any async work so the user sees a
    // full-screen spinner immediately instead of a blank pick screen for 1-3 s.
    const myGen = ++bgGenRef.current;
    setOriginalBlob(null);
    setOriginalUrl(null);
    setCleanedBlob(null);
    setCleanedUrl(null);
    setBgFailed(false);
    setBgProcessing(false);
    setSelected("original");
    setPhase("encoding");

    // Encode to JPEG ≤ 2048 px
    let jpeg: Blob;
    try {
      jpeg = await encodeForUpload(file);
    } catch (err) {
      if (bgGenRef.current !== myGen) return;
      setErrorMsg(`Could not read the photo: ${err instanceof Error ? err.message : String(err)}`);
      setPhase("pick");
      return;
    }
    if (bgGenRef.current !== myGen) return;

    // Show original immediately, switch to comparison screen
    setOriginalBlob(jpeg);
    setOriginalUrl(URL.createObjectURL(jpeg));
    setPhase("preview");

    // Background removal — generation guard discards stale results
    setBgProcessing(true);
    try {
      const dataUrl    = await blobToDataUrl(jpeg);
      if (bgGenRef.current !== myGen) return;
      const resultUrl  = await removeBackground(dataUrl);
      if (bgGenRef.current !== myGen) return;
      const resultBlob   = await dataUrlToBlob(resultUrl);
      const resultObjUrl = URL.createObjectURL(resultBlob);
      if (bgGenRef.current !== myGen) { URL.revokeObjectURL(resultObjUrl); return; }
      setCleanedBlob(resultBlob);
      setCleanedUrl(resultObjUrl);
      setSelected("cleaned");
    } catch (err) {
      if (bgGenRef.current !== myGen) return;
      console.warn("Background removal failed:", err);
      setBgFailed(true);
    } finally {
      if (bgGenRef.current === myGen) setBgProcessing(false);
    }
  }, []);

  // ── handleSave — save selected version to DB ──────────────────────────────

  const handleSave = useCallback(async () => {
    const blob = selected === "cleaned" && cleanedBlob ? cleanedBlob : originalBlob;
    if (!blob) return;
    setPhase("uploading");

    try {
      const path     = await blobToDataUrl(blob);
      const label    = names[category as CategoryKey] ?? category;
      const n        = existingCount + 1;
      const autoName = n === 1 ? label : `${label} ${n}`;

      await new Promise<void>((resolve, reject) => {
        createItem.mutate(
          { data: { name: autoName, category, imageObjectPath: path } },
          {
            onSuccess: (createdItem) => {
              queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
              queryClient.invalidateQueries({ queryKey: getWardrobeStatsQueryKey() });
              if (onCreated) onCreated(createdItem);
              resolve();
            },
            onError: reject,
          },
        );
      });

      handleClose();
    } catch (err) {
      setErrorMsg(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
      setPhase("preview");
    }
  }, [selected, cleanedBlob, originalBlob, category, existingCount, createItem, queryClient, onCreated, handleClose]);

  // ── handleFiles — bulk save (no comparison UI) for multi-select from gallery ─

  const saveOneBlob = useCallback(async (blob: Blob, index: number): Promise<boolean> => {
    try {
      const jpeg  = await encodeForUpload(blob);

      // Attempt background removal; fall back to original if it fails
      let finalBlob: Blob = jpeg;
      try {
        const dataUrl    = await blobToDataUrl(jpeg);
        const cleanedUrl = await removeBackground(dataUrl);
        finalBlob        = await dataUrlToBlob(cleanedUrl);
      } catch {
        // background removal failed — use original JPEG
      }

      const path     = await blobToDataUrl(finalBlob);
      const label    = names[category as CategoryKey] ?? category;
      const n        = existingCount + index + 1;
      const autoName = n === 1 ? label : `${label} ${n}`;
      await new Promise<void>((resolve, reject) => {
        createItem.mutate(
          { data: { name: autoName, category, imageObjectPath: path } },
          {
            onSuccess: (createdItem) => {
              queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
              queryClient.invalidateQueries({ queryKey: getWardrobeStatsQueryKey() });
              if (onCreated) onCreated(createdItem);
              resolve();
            },
            onError: reject,
          },
        );
      });
      return true;
    } catch {
      return false;
    }
  }, [category, existingCount, createItem, queryClient, onCreated, names]);

  const handleFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    bgGenRef.current += 1; // cancel any in-flight bg removal
    setBgProcessing(false);
    setErrorMsg(null);
    setPhase("uploading");
    setBulkProgress({ current: 0, total: files.length });

    let failed = 0;
    for (let i = 0; i < files.length; i++) {
      setBulkProgress({ current: i + 1, total: files.length });
      const ok = await saveOneBlob(files[i], i);
      if (!ok) failed++;
    }

    setBulkProgress(null);
    if (failed > 0) {
      setErrorMsg(`${failed} photo${failed > 1 ? "s" : ""} could not be saved. Please try again.`);
      setPhase("pick");
    } else {
      handleClose();
    }
  }, [saveOneBlob, handleClose]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, source: "camera" | "gallery") => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    // Camera always single; gallery: single → comparison, multiple → bulk save
    if (source === "gallery" && files.length > 1) {
      handleFiles(files);
    } else {
      handleFile(files[0]);
    }
  };

  if (!open) return null;

  const label = names[category as CategoryKey] ?? category;

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[70] flex flex-col max-w-md mx-auto bg-[#f9f4ee]"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 bg-white border-b-2 border-black flex-shrink-0"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "0.75rem" }}>
        <h2 className="font-display font-bold text-xl uppercase tracking-tight">
          Add {label}
        </h2>
        {(phase === "pick" || phase === "preview") && (
          <button
            onClick={handleClose}
            className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                       bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                       active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Body — NO AnimatePresence on phase blocks (causes blank-screen flash on every transition) */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>

        {/* ── Pick ── */}
        {phase === "pick" && (
          <div className="flex flex-col p-5 gap-5">
            {errorMsg && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
                {errorMsg}
              </p>
            )}

            {/* Two big action buttons */}
            <div className="flex gap-3">
              {/* Take Photo */}
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center gap-3 py-8
                           border-4 border-black rounded-2xl bg-primary
                           shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-1 active:translate-y-1 active:shadow-none
                           transition-all"
              >
                <span className="text-4xl leading-none">📷</span>
                <span className="font-display font-bold text-base uppercase tracking-tight text-center leading-tight">
                  Take<br />Photo
                </span>
              </button>

              {/* Upload Photo */}
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center gap-3 py-8
                           border-4 border-black rounded-2xl bg-white
                           shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-1 active:translate-y-1 active:shadow-none
                           transition-all"
              >
                <span className="text-4xl leading-none">🖼️</span>
                <span className="font-display font-bold text-base uppercase tracking-tight text-center leading-tight">
                  Upload<br />Photo
                </span>
              </button>
            </div>

            {/* Photo tips */}
            <div className="border-2 border-black rounded-2xl bg-white p-4
                            shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <p className="font-display font-bold text-sm uppercase tracking-tight mb-3 flex items-center gap-2">
                <span>📸</span> PHOTO TIPS
              </p>
              <ul className="flex flex-col gap-2">
                {PHOTO_TIPS.map((tip) => (
                  <li key={tip} className="flex items-start gap-2 text-sm text-black/70 leading-snug">
                    <span className="mt-0.5 w-4 h-4 border-2 border-black rounded-sm bg-primary
                                     flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5" strokeWidth={3} />
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ── Encoding — full-screen spinner, shown immediately after photo is picked ── */}
        {phase === "encoding" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", gap: 20, padding: 24 }}>
            <div className="w-28 h-28 border-4 border-black rounded-3xl bg-white
                            flex items-center justify-center
                            shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <Loader2 className="w-12 h-12 animate-spin" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="font-display font-bold text-2xl uppercase tracking-tight">Processing…</p>
              <p className="text-sm text-muted-foreground mt-1">Getting your photo ready.</p>
            </div>
          </div>
        )}

        {/* ── Preview — side-by-side comparison ── */}
        {phase === "preview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 20 }}>
            {errorMsg && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
                {errorMsg}
              </p>
            )}

            <p style={{ textAlign: "center", fontWeight: "bold", fontSize: 11,
                        textTransform: "uppercase", letterSpacing: 2, opacity: 0.4 }}>
              {bgProcessing ? "This will take a moment…" : bgFailed ? "Original" : "Tap to choose"}
            </p>

            {/* Side-by-side cards */}
            <div style={{ display: "flex", gap: 12 }}>

              {/* Original card */}
              <button
                onClick={() => setSelected("original")}
                style={{
                  flex: 1,
                  opacity: selected === "original" ? 1 : 0.5,
                  border: selected === "original" ? "4px solid black" : "4px solid rgba(0,0,0,0.2)",
                  borderRadius: 16, overflow: "hidden", background: "none", padding: 0,
                  cursor: "pointer",
                }}
              >
                <div style={{ background: "black", minHeight: 176, position: "relative" }}>
                  <img
                    src={originalUrl!}
                    alt="Original"
                    style={{ width: "100%", objectFit: "contain", maxHeight: 176, display: "block" }}
                  />
                  {selected === "original" && (
                    <div style={{ position: "absolute", top: 6, right: 6, width: 20, height: 20,
                                  borderRadius: "50%", background: "black",
                                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Check size={12} color="white" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <p style={{ textAlign: "center", fontWeight: "bold", fontSize: 11,
                            textTransform: "uppercase", padding: "6px 0", margin: 0 }}>
                  Original
                </p>
              </button>

              {/* Cleaned card */}
              <button
                onClick={() => cleanedUrl && setSelected("cleaned")}
                disabled={!cleanedUrl}
                style={{
                  flex: 1,
                  opacity: selected === "cleaned" && cleanedUrl ? 1 : 0.5,
                  border: selected === "cleaned" && cleanedUrl ? "4px solid black" : "4px solid rgba(0,0,0,0.2)",
                  borderRadius: 16, overflow: "hidden", background: "none", padding: 0,
                  cursor: cleanedUrl ? "pointer" : "default",
                }}
              >
                {/* Checkerboard background reveals transparency */}
                <div style={{
                  background: "repeating-conic-gradient(#d1d5db 0% 25%, white 0% 50%) 0 0 / 12px 12px",
                  minHeight: 176, position: "relative",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {cleanedUrl ? (
                    <>
                      <img
                        src={cleanedUrl}
                        alt="Background removed"
                        style={{ width: "100%", objectFit: "contain", maxHeight: 176, display: "block" }}
                      />
                      {selected === "cleaned" && (
                        <div style={{ position: "absolute", top: 6, right: 6, width: 20, height: 20,
                                      borderRadius: "50%", background: "black",
                                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Check size={12} color="white" strokeWidth={3} />
                        </div>
                      )}
                    </>
                  ) : bgFailed ? (
                    <p style={{ fontSize: 12, fontWeight: "bold", textTransform: "uppercase",
                                opacity: 0.4, textAlign: "center", padding: "0 12px", margin: 0 }}>
                      Could not remove background
                    </p>
                  ) : (
                    /* Shown while model runs */
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <Loader2 size={32} style={{ opacity: 0.5 }} className="animate-spin" />
                      <p style={{ fontSize: 13, fontWeight: "bold", textTransform: "uppercase",
                                  opacity: 0.5, margin: 0 }}>Processing</p>
                    </div>
                  )}
                </div>
                <p style={{ textAlign: "center", fontWeight: "bold", fontSize: 11,
                            textTransform: "uppercase", padding: "6px 0", margin: 0 }}>
                  Cleaned ✨
                </p>
              </button>

            </div>

            {/* Action row */}
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setPhase("pick")}
                className="flex-1 border-4 border-black rounded-2xl bg-white py-3
                           font-display font-bold text-sm uppercase tracking-tight
                           shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
              >
                ↩ Retake
              </button>
              <button
                onClick={handleSave}
                disabled={bgProcessing && selected !== "original"}
                className="flex-1 border-4 border-black rounded-2xl bg-primary py-3
                           font-display font-bold text-sm uppercase tracking-tight
                           shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all
                           disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-x-0 disabled:active:translate-y-0 disabled:active:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
              >
                {bgProcessing && selected !== "original" ? "Processing…" : "✓ Save to Library"}
              </button>
            </div>
          </div>
        )}

        {/* ── Uploading ── */}
        {phase === "uploading" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", gap: 20 }}>
            <div className="w-28 h-28 border-4 border-black rounded-3xl bg-white
                            flex items-center justify-center
                            shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <Loader2 className="w-12 h-12 animate-spin" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="font-display font-bold text-2xl uppercase tracking-tight">Saving…</p>
              <p className="text-sm text-muted-foreground mt-1">
                {bulkProgress && bulkProgress.total > 1
                  ? `Photo ${bulkProgress.current} of ${bulkProgress.total}`
                  : "Adding to your library."}
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Hidden file inputs */}
      {/* Camera — opens native camera on mobile */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleInputChange(e, "camera")}
      />
      {/* Gallery — opens photo library / file picker (multiple selection supported) */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleInputChange(e, "gallery")}
      />
    </motion.div>
  );
}
