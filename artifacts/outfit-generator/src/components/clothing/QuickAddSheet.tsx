/**
 * QuickAddSheet
 *
 * Upload flow:
 *   pick ──(file chosen)──► encoding ──► uploading ──► close
 */
import React, { useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Loader2, Check } from "lucide-react";
import {
  useCreateClothingItem,
  getListClothingQueryKey,
  getWardrobeStatsQueryKey,
} from "@/hooks/useLocalDB";
import { useQueryClient } from "@tanstack/react-query";
import { blobToDataUrl } from "@/lib/backgroundRemoval";
import { useCategoryNames, type CategoryKey } from "@/hooks/useCategoryNames";

// ── Types ──────────────────────────────────────────────────────────────────────

type Category = "outfits" | "beauty" | "toiletries" | "essentials";

type Phase =
  | "pick"       // two-button landing screen
  | "encoding"   // full-screen spinner while canvas-encoding the photo
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
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

  // Two separate file inputs: one triggers camera, one opens gallery
  const cameraInputRef  = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const createItem  = useCreateClothingItem();
  const queryClient = useQueryClient();

  // ── Reset ─────────────────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    setPhase("pick");
    setErrorMsg(null);
    setBulkProgress(null);
    onOpenChange(false);
  }, [onOpenChange]);

  // ── handleFile — encode then save directly ────────────────────────────────

  const handleFile = useCallback(async (file: File | Blob, index = 0) => {
    setErrorMsg(null);
    setPhase("encoding");
    try {
      const jpeg = await encodeForUpload(file);
      setPhase("uploading");
      const path     = await blobToDataUrl(jpeg);
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
      handleClose();
    } catch (err) {
      setErrorMsg(`Could not save: ${err instanceof Error ? err.message : String(err)}`);
      setPhase("pick");
    }
  }, [category, existingCount, createItem, queryClient, onCreated, names, handleClose]);

  // ── handleFiles — bulk save for multi-select ──────────────────────────────

  const handleFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setErrorMsg(null);
    setPhase("uploading");
    setBulkProgress({ current: 0, total: files.length });
    let failed = 0;
    for (let i = 0; i < files.length; i++) {
      setBulkProgress({ current: i + 1, total: files.length });
      try {
        const jpeg = await encodeForUpload(files[i]);
        const path = await blobToDataUrl(jpeg);
        const label    = names[category as CategoryKey] ?? category;
        const n        = existingCount + i + 1;
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
      } catch { failed++; }
    }
    setBulkProgress(null);
    if (failed > 0) {
      setErrorMsg(`${failed} photo${failed > 1 ? "s" : ""} could not be saved. Please try again.`);
      setPhase("pick");
    } else {
      handleClose();
    }
  }, [category, existingCount, createItem, queryClient, onCreated, names, handleClose]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    if (files.length > 1) handleFiles(files);
    else handleFile(files[0]);
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
        {phase === "pick" && (
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
                <span className="font-display font-bold text-base uppercase tracking-tight text-center leading-tight text-primary-foreground">
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
      {/* Camera — shows native photo picker (camera + library); capture="environment"
          omitted intentionally: forcing the camera directly crashes WKWebView on iOS */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
      />
      {/* Gallery — opens photo library / file picker (multiple selection supported) */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />
    </motion.div>
  );
}
