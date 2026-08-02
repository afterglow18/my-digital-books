/**
 * ItemDetailsSheet — full-screen overlay showing a clothing item's details.
 * Every field is optional and editable. A "Save" button appears only when
 * the form is dirty. Delete is always available.
 *
 * showAddToLookbook (optional):
 *   When true an "Add to Lookbook" button appears in the footer.
 *   Tapping opens an inline LookbookPicker that lets the user toggle the item
 *   in and out of any saved reading list.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Heart, Trash2, Save, ChevronDown, Loader2, Check, BookMarked,
} from "lucide-react";
import {
  type ClothingItem,
  type SavedOutfit,
  type ClothingItemUpdateCategory,
  useUpdateClothingItem,
  useDeleteClothingItem,
  useListOutfits,
  useAddItemToOutfit,
  useRemoveItemFromOutfit,
  getListClothingQueryKey,
  getListOutfitsQueryKey,
  getWardrobeStatsQueryKey,
} from "@/hooks/useLocalDB";
import { useQueryClient } from "@tanstack/react-query";
import { getImageUrl } from "@/lib/utils";
import { useCategoryNames, type CategoryKey } from "@/hooks/useCategoryNames";

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function fmtDate(s: string): string {
  const [y, m, d] = s.split("-");
  return `${parseInt(m)}/${parseInt(d)}/${y.slice(2)}`;
}

const SEASON_OPTIONS    = ["", "Spring", "Summer", "Fall", "Winter", "All Season"];
const OCCASION_OPTIONS  = ["", "Casual", "Work", "Formal", "Sport", "Special Event"];

function Field({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? label}
        className="w-full border-2 border-black rounded-lg px-3 py-2 text-sm font-medium
                   bg-white focus:outline-none focus:ring-2 focus:ring-primary
                   placeholder:font-normal placeholder:text-black/25"
      />
    </div>
  );
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[] | { label: string; value: string }[];
}) {
  const normalised = (options as Array<string | { label: string; value: string }>).map((o) =>
    typeof o === "string" ? { label: o || `— ${label} —`, value: o } : o,
  );
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none border-2 border-black rounded-lg px-3 py-2 pr-8
                     text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-primary
                     cursor-pointer"
        >
          {normalised.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-black/40" />
      </div>
    </div>
  );
}

// ── Lookbook picker ───────────────────────────────────────────────────────────

function LookbookPicker({
  item,
  onClose,
}: {
  item: ClothingItem;
  onClose: () => void;
}) {
  const { data: groups = [] } = useListOutfits();
  const addToOutfit    = useAddItemToOutfit();
  const removeFromOutfit = useRemoveItemFromOutfit();
  const queryClient    = useQueryClient();

  const inOutfitSet = new Set(
    groups.filter((g) => (g.items ?? []).some((i) => i.id === item.id)).map((g) => g.id)
  );

  const toggle = (group: SavedOutfit) => {
    const inGroup = inOutfitSet.has(group.id);
    const fn = inGroup ? removeFromOutfit : addToOutfit;
    if (inGroup) {
      removeFromOutfit.mutate(
        { id: group.id, itemId: item.id },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() }) }
      );
    } else {
      addToOutfit.mutate(
        { id: group.id, data: { itemId: item.id } },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() }) }
      );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 260 }}
      className="fixed inset-0 z-[70] flex flex-col max-w-md mx-auto bg-[#f9f4ee]"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 border-b-2 border-black bg-[#f9f4ee] flex-shrink-0"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "0.75rem" }}
      >
        <h2 className="font-display font-bold text-xl uppercase tracking-tight">
          Add to Lookbook
        </h2>
        <button
          onClick={onClose}
          className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                     bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                     active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {groups.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16 px-8">
            <p className="text-3xl mb-3">📚</p>
            <p className="font-display font-bold text-lg uppercase tracking-tight mb-1">No lists yet</p>
            <p className="text-sm text-muted-foreground">
              Create a reading list on the My Reads tab first.
            </p>
          </div>
        ) : (
          groups.map((group) => {
            const inGroup = inOutfitSet.has(group.id);
            const thumbs  = (group.items ?? []).filter((i) => i.id !== item.id).slice(0, 3);

            return (
              <button
                key={group.id}
                onClick={() => toggle(group)}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl border-2 border-black w-full text-left
                            shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                            active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all
                            ${inGroup ? "bg-primary text-primary-foreground" : "bg-white hover:bg-secondary/20"}`}
              >
                {/* Thumbnails */}
                <div className="flex gap-1 flex-shrink-0">
                  {[0, 1, 2].map((i) => {
                    const it = thumbs[i];
                    return (
                      <div
                        key={i}
                        className="w-10 h-10 border-2 border-black rounded overflow-hidden"
                        style={{ background: "#F5EDD8" }}
                      >
                        {it?.imageObjectPath ? (
                          <img
                            src={getImageUrl(it.imageObjectPath)!}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {/* Name + count */}
                <div className="flex-1 min-w-0">
                  <p className={`font-display font-bold text-sm uppercase tracking-tight truncate
                                 ${inGroup ? "text-primary-foreground" : ""}`}>
                    {group.name}
                  </p>
                  <p className={`text-xs ${inGroup ? "text-primary-foreground/70" : "text-black/40"}`}>
                    {group.items?.length ?? 0} item{(group.items?.length ?? 0) !== 1 ? "s" : ""}
                  </p>
                </div>

                {/* Checkmark */}
                {inGroup && (
                  <div className="w-6 h-6 rounded-full bg-white/20 border-2 border-white/50 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </motion.div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ItemDetailsSheetProps {
  item:               ClothingItem | null;
  onClose:            () => void;
  onDeleted?:         () => void;
  showAddToLookbook?: boolean;
}

interface FormState {
  name: string; brand: string; color: string; size: string;
  season: string; occasion: string; purchasePrice: string;
  purchaseDate: string; notes: string; isFavorite: boolean; category: string;
}

function toForm(item: ClothingItem): FormState {
  return {
    name:          item.name          ?? "",
    brand:         item.brand         ?? "",
    color:         item.color         ?? "",
    size:          item.size          ?? "",
    season:        item.season        ?? "",
    occasion:      item.occasion      ?? "",
    purchasePrice: item.purchasePrice ?? "",
    purchaseDate:  item.purchaseDate  ?? "",
    notes:         item.notes         ?? "",
    isFavorite:    item.isFavorite    ?? false,
    category:      item.category      ?? "",
  };
}

function isDirty(form: FormState, item: ClothingItem): boolean {
  return (
    form.name          !== (item.name          ?? "") ||
    form.brand         !== (item.brand         ?? "") ||
    form.color         !== (item.color         ?? "") ||
    form.size          !== (item.size          ?? "") ||
    form.season        !== (item.season        ?? "") ||
    form.occasion      !== (item.occasion      ?? "") ||
    form.purchasePrice !== (item.purchasePrice ?? "") ||
    form.purchaseDate  !== (item.purchaseDate  ?? "") ||
    form.notes         !== (item.notes         ?? "") ||
    form.isFavorite    !== (item.isFavorite    ?? false) ||
    form.category      !== (item.category      ?? "")
  );
}

export function ItemDetailsSheet({
  item,
  onClose,
  onDeleted,
  showAddToLookbook = false,
}: ItemDetailsSheetProps) {
  const { names } = useCategoryNames();
  const [form, setForm]           = useState<FormState | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLookbookPicker, setShowLookbookPicker] = useState(false);
  const [displayImageUrl, setDisplayImageUrl] = useState<string | null>(null);

  const [timesRead,       setTimesRead]       = useState(0);
  const [timesReadInput,  setTimesReadInput]  = useState("0");
  const [lastReadDate,    setLastReadDate]    = useState<string | null>(null);
  const [prevLastReadDate, setPrevLastReadDate] = useState<string | null>(null);

  const updateItem  = useUpdateClothingItem();
  const deleteItem  = useDeleteClothingItem();
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getWardrobeStatsQueryKey() });
  };

  useEffect(() => {
    if (item) {
      setForm(toForm(item));
      setTimesRead(item.timesWorn ?? 0);
      setTimesReadInput(String(item.timesWorn ?? 0));
      setLastReadDate((item as any).lastReadDate ?? null);
      setPrevLastReadDate(null);
    }
    setShowDeleteConfirm(false);
    setShowLookbookPicker(false);
    setDisplayImageUrl(null);
  }, [item?.id]);

  if (!item || !form) return null;

  const dirty = isDirty(form, item);

  const patch = (key: keyof FormState) => (value: string | boolean) =>
    setForm((prev) => prev ? { ...prev, [key]: value } : prev);

  const handleSave = () => {
    updateItem.mutate(
      {
        id: item.id,
        data: {
          name:          form.name.trim() || item.name,
          brand:         form.brand.trim(),
          color:         form.color.trim(),
          size:          form.size.trim(),
          season:        form.season,
          occasion:      form.occasion,
          purchasePrice: form.purchasePrice.trim(),
          purchaseDate:  form.purchaseDate.trim(),
          notes:         form.notes.trim(),
          isFavorite:    form.isFavorite,
          category:      (form.category || item.category) as ClothingItemUpdateCategory,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getWardrobeStatsQueryKey() });
          onClose();
        },
      }
    );
  };

  const handleDelete = () => {
    deleteItem.mutate(
      { id: item.id },
      {
        onSuccess: () => {
          invalidateAll();
          onDeleted?.();
          onClose();
        },
      }
    );
  };

  const isBooks   = item.category === "outfits";
  const today     = todayStr();
  const loggedToday = lastReadDate === today;

  const handleLogRead = () => {
    const next = timesRead + 1;
    setPrevLastReadDate(lastReadDate);
    setTimesRead(next);
    setTimesReadInput(String(next));
    setLastReadDate(today);
    updateItem.mutate(
      { id: item.id, data: { timesWorn: next, lastReadDate: today } as any },
      { onSuccess: invalidateAll },
    );
  };

  const handleUndoRead = () => {
    const next = Math.max(0, timesRead - 1);
    setTimesRead(next);
    setTimesReadInput(String(next));
    setLastReadDate(prevLastReadDate);
    setPrevLastReadDate(null);
    updateItem.mutate(
      { id: item.id, data: { timesWorn: next, lastReadDate: prevLastReadDate } as any },
      { onSuccess: invalidateAll },
    );
  };

  const handleTimesReadBlur = () => {
    const n = parseInt(timesReadInput, 10);
    if (!isNaN(n) && n >= 0 && n !== timesRead) {
      setTimesRead(n);
      updateItem.mutate(
        { id: item.id, data: { timesWorn: n } },
        { onSuccess: invalidateAll },
      );
    } else {
      setTimesReadInput(String(timesRead));
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 240 }}
        className="fixed inset-0 z-[65] flex flex-col max-w-md mx-auto bg-[#f9f4ee] overflow-y-auto"
      >
        {/* ── Header ── */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-4
                      bg-[#f9f4ee] border-b-2 border-black flex-shrink-0"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "0.75rem" }}
        >
          <h2 className="font-display font-bold text-xl uppercase tracking-tight">
            Item Details
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const next = !form.isFavorite;
                patch("isFavorite")(next);
                updateItem.mutate(
                  { id: item.id, data: { isFavorite: next } },
                  {
                    onSuccess: () => {
                      queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
                      queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
                      queryClient.invalidateQueries({ queryKey: getWardrobeStatsQueryKey() });
                    },
                  }
                );
              }}
              className={`w-9 h-9 border-2 border-black rounded-full flex items-center justify-center transition-all
                          ${form.isFavorite
                            ? "bg-red-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            : "bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"}`}
              title="Favourite"
            >
              <Heart
                className="w-4 h-4"
                fill={form.isFavorite ? "white" : "none"}
                stroke={form.isFavorite ? "white" : "currentColor"}
              />
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                         bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                         active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Photo ── */}
        {item.imageObjectPath && (
          <div className="flex-shrink-0 border-b-2 border-black">
            <div
              className="w-full h-52"
              style={{
                backgroundImage: "repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%)",
                backgroundSize: "16px 16px",
              }}
            >
              <img
                src={displayImageUrl ?? getImageUrl(item.imageObjectPath)!}
                alt={item.name}
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        )}

        {/* ── Reading This Today button (books only) ── */}
        {isBooks && (
          <div className="flex-shrink-0 px-4 pt-4 pb-1">
            {!loggedToday ? (
              <button
                onClick={handleLogRead}
                className="w-full py-3 rounded-xl flex items-center justify-center gap-2
                           font-display font-bold text-sm uppercase tracking-wide
                           border-2 border-primary text-primary-foreground
                           bg-primary shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                           active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
              >
                📖 Read Today
              </button>
            ) : (
              <button
                onClick={handleUndoRead}
                className="w-full py-3 rounded-xl flex items-center justify-center gap-2
                           font-display font-bold text-sm uppercase tracking-wide
                           border-2 border-black/20 text-black/50 bg-white
                           shadow-[2px_2px_0px_0px_rgba(0,0,0,0.15)]
                           active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
              >
                ✓ Logged
              </button>
            )}
          </div>
        )}

        {/* ── Form ── */}
        <div className="flex-1 px-4 py-5 flex flex-col gap-4">
          <Field
            label="Item Name"
            value={form.name}
            onChange={patch("name") as (v: string) => void}
            placeholder="e.g. White Linen Shirt"
          />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Brand" value={form.brand} onChange={patch("brand") as (v: string) => void} placeholder="Nike, Zara…" />
            <Field label="Color" value={form.color} onChange={patch("color") as (v: string) => void} placeholder="Navy Blue" />
          </div>

          <Field label="Size / Volume" value={form.size} onChange={patch("size") as (v: string) => void} placeholder="30ml, 50ml, Full Size…" />

          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Season"   value={form.season}   onChange={patch("season") as (v: string) => void}   options={SEASON_OPTIONS} />
            <SelectField label="Occasion" value={form.occasion} onChange={patch("occasion") as (v: string) => void} options={OCCASION_OPTIONS} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Purchase Price" value={form.purchasePrice} onChange={patch("purchasePrice") as (v: string) => void} placeholder="$49.99" />
            <Field label="Date"  value={form.purchaseDate}  onChange={patch("purchaseDate") as (v: string) => void}  type="date" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => patch("notes")(e.target.value)}
              placeholder="Anything worth remembering…"
              rows={3}
              className="w-full border-2 border-black rounded-lg px-3 py-2 text-sm font-medium
                         bg-white focus:outline-none focus:ring-2 focus:ring-primary resize-none
                         placeholder:font-normal placeholder:text-black/25"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Category"
              value={form.category}
              onChange={patch("category") as (v: string) => void}
              options={[
                { value: "outfits",    label: names["outfits"]    ?? "Books"     },
                { value: "beauty",     label: names["beauty"]     ?? "Authors"   },
                { value: "toiletries", label: names["toiletries"] ?? "Series"    },
                { value: "essentials", label: names["essentials"] ?? "Bookmarks" },
              ]}
            />
            {isBooks ? (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">
                  Times Read
                </label>
                <input
                  type="number"
                  min={0}
                  value={timesReadInput}
                  onChange={e => setTimesReadInput(e.target.value)}
                  onBlur={handleTimesReadBlur}
                  className="w-full border-2 border-black rounded-lg px-3 py-2 text-sm font-medium
                             bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {lastReadDate && (
                  <span className="text-[10px] text-black/40 font-medium mt-0.5">
                    Last read: {fmtDate(lastReadDate)}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-1 opacity-50 pointer-events-none">
                <span className="text-[10px] font-bold uppercase tracking-widest text-black/40">Times Worn</span>
                <div className="border-2 border-black/20 rounded-lg px-3 py-2 text-sm font-medium bg-white/50">
                  {item.timesWorn ?? 0}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer actions ── */}
        <div className="sticky bottom-0 px-4 py-4 bg-[#f9f4ee] border-t-2 border-black flex-shrink-0 flex flex-col gap-2">

          {/* Save (only when dirty) */}
          <AnimatePresence>
            {dirty && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                onClick={handleSave}
                disabled={updateItem.isPending}
                className="w-full btn-brutalist py-3 rounded-xl flex items-center justify-center gap-2 text-sm"
              >
                <Save className="w-4 h-4" />
                {updateItem.isPending ? "Saving…" : "Save Changes"}
              </motion.button>
            )}
          </AnimatePresence>

          {/* Add to Lookbook (when enabled) */}
          {showAddToLookbook && (
            <button
              onClick={() => setShowLookbookPicker(true)}
              className="w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm
                         font-bold uppercase border-2 border-black bg-white
                         shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                         active:translate-y-0.5 active:translate-x-0.5 active:shadow-none
                         hover:bg-secondary/30 transition-all"
            >
              <BookMarked className="w-4 h-4" />
              Add to Lookbook
            </button>
          )}

          {/* Delete */}
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm
                         font-bold uppercase border-2 border-black/20 text-black/35
                         hover:border-red-500 hover:text-red-600 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Delete from Library Forever
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl text-sm font-bold uppercase border-2 border-black bg-white
                           shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                           active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteItem.isPending}
                className="flex-1 py-3 rounded-xl text-sm font-bold uppercase border-2 border-red-600
                           bg-red-500 text-white
                           shadow-[2px_2px_0px_0px_rgba(185,28,28,1)]
                           active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all
                           disabled:opacity-50"
              >
                {deleteItem.isPending ? "Deleting…" : "Yes, Delete Forever"}
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Lookbook picker (z-level above the details sheet) ── */}
      <AnimatePresence>
        {showLookbookPicker && (
          <LookbookPicker
            item={item}
            onClose={() => setShowLookbookPicker(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
