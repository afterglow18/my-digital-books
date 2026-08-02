/**
 * Local IndexedDB database for My Digital Books.
 *
 * Schema v2 (adds vision fields for photo-search indexing):
 *   clothing_items  — wardrobe items with embedded image data URLs
 *   saved_outfits   — named outfit collections
 *   outfit_items    — junction: outfit ↔ clothing item
 *   settings        — key/value store for app preferences
 */

import { openDB, type IDBPDatabase } from "idb";

export const DB_NAME    = "my-digital-suitcase";
export const DB_VERSION = 2;

// ── Stored types (IndexedDB records) ─────────────────────────────────────────

export interface StoredClothingItem {
  id?:             number;        // auto-incremented
  name:            string;
  category:        string;        // "outfits" | "beauty" | "toiletries" | "essentials"
  imageObjectPath: string | null; // JPEG data URL
  isFavorite:      boolean;
  timesWorn:       number;
  lastReadDate?:   string | null; // "YYYY-MM-DD" local date, null if never read
  color?:          string | null;
  brand?:          string | null;
  size?:           string | null;
  season?:         string | null;
  occasion?:       string | null;
  purchasePrice?:  string | null;
  purchaseDate?:   string | null;
  notes?:          string | null;
  createdAt:       string;
  updatedAt:       string;
  // v2 — vision-search fields; default [] / 0 for records pre-dating this version
  visionLabels?:   string[];      // colour/object labels from Vision or canvas
  visionText?:     string[];      // text detected inside the photo
  visionVersion?:  number;        // 0=unanalyzed 1=iOS Vision 4=web canvas 5=web no-labels
}

export interface StoredOutfit {
  id?:       number;
  name:      string;
  notes?:    string | null;
  createdAt: string;
}

export interface StoredOutfitItem {
  id?:             number;
  outfitId:        number;
  clothingItemId:  number;
}

export interface StoredSetting {
  key:   string;
  value: string;
}

// ── Public types (consumed by hooks and pages) ────────────────────────────────

export interface ClothingItem extends Required<StoredClothingItem> {
  id: number;
  visionLabels: string[];
  visionText:   string[];
  visionVersion: number;
}

export interface SavedOutfit {
  id:        number;
  name:      string;
  notes?:    string | null;
  createdAt: string;
  items:     ClothingItem[];
}

// ── Singleton DB connection ───────────────────────────────────────────────────

let _db: IDBPDatabase | null = null;

export async function getDB(): Promise<IDBPDatabase> {
  if (_db) return _db;

  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // ── v1 stores ──
      if (oldVersion < 1) {
        const items = db.createObjectStore("clothing_items", {
          keyPath: "id", autoIncrement: true,
        });
        items.createIndex("by_category", "category");
        items.createIndex("by_favorite", "isFavorite");

        db.createObjectStore("saved_outfits", {
          keyPath: "id", autoIncrement: true,
        });

        const links = db.createObjectStore("outfit_items", {
          keyPath: "id", autoIncrement: true,
        });
        links.createIndex("by_outfit", "outfitId");
        links.createIndex("by_item",   "clothingItemId");

        db.createObjectStore("settings", { keyPath: "key" });
      }
      // ── v2 — vision fields are optional on existing records; no data migration needed ──
      // Existing records will simply return undefined for visionLabels/visionText/visionVersion,
      // which localDB.ts normalises to [] / [] / 0 at read time.
    },

    blocked() {
      console.warn("[DB] Upgrade blocked — close other tabs");
    },

    blocking() {
      _db?.close();
      _db = null;
    },
  });

  return _db;
}
