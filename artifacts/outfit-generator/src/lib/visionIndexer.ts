/**
 * visionIndexer — background photo-search indexer.
 *
 * Runs after the app loads and processes items that haven't been analysed yet
 * (or that were analysed with an older version and need a re-index).
 *
 * Version scheme
 *   0  unanalysed
 *   1  old iOS-Vision-only pass (no canvas colours) — re-index on iOS
 *   2  iOS Vision labels + canvas colours merged          ← current iOS target
 *   4  web canvas colours only                            ← current web target
 *   5  web canvas ran but found nothing (blank/no photo)  — skip on web
 *
 * iOS fix (why v2 ≠ v1):
 *   Apple Vision classifies objects ("shoe", "high heel") but never outputs
 *   colour names.  The fix is to run canvas colour extraction in parallel with
 *   the native Vision call and merge results.  Items previously indexed at v1
 *   (labels only) are re-indexed so colours enter the search index.
 */

import { Capacitor } from "@capacitor/core";
import { getDB, type ClothingItem } from "./db";
import { extractColorsFromUrl } from "./visionWeb";
import { analyzeImageNative } from "./visionNative";

// ── Version constants ──────────────────────────────────────────────────────────

const NATIVE_VERSION = 2;  // iOS: Vision labels + canvas colours
const WEB_VERSION    = 4;  // Web: canvas colours only
const WEB_SKIP       = 5;  // Web: canvas ran, zero colours → skip on next launch

const INTER_ITEM_DELAY_MS = 350;

// ── State ─────────────────────────────────────────────────────────────────────

type Listener = (indexing: boolean) => void;

const _listeners = new Set<Listener>();
let   _indexing  = false;
let   _queue: number[] = [];   // ids waiting to be processed immediately

function setIndexing(v: boolean) {
  _indexing = v;
  _listeners.forEach((cb) => cb(v));
}

/** Subscribe to indexing-state changes.  Returns an unsubscribe function. */
export function subscribeIndexerState(cb: Listener): () => void {
  _listeners.add(cb);
  cb(_indexing); // fire immediately with current state
  return () => _listeners.delete(cb);
}

// ── Needs-indexing predicate ──────────────────────────────────────────────────

function needsIndexing(item: ClothingItem, isNative: boolean): boolean {
  const v = item.visionVersion ?? 0;
  if (!item.imageObjectPath) return false;   // no photo — nothing to index
  if (isNative) return v < NATIVE_VERSION;
  return v < WEB_VERSION && v !== WEB_SKIP;
}

// ── Core processing ───────────────────────────────────────────────────────────

async function processItem(item: ClothingItem, isNative: boolean): Promise<void> {
  const dataUrl = item.imageObjectPath;
  if (!dataUrl) return;

  try {
    let labels: string[] = [];
    let texts:  string[] = [];
    let version: number;

    if (isNative) {
      // Run native Vision (object labels + OCR) and canvas colour extraction
      // in parallel — native Vision never returns colour names so we need both.
      const [nativeResult, canvasColors] = await Promise.all([
        analyzeImageNative(dataUrl),
        extractColorsFromUrl(dataUrl),
      ]);

      // Merge: native labels first, then canvas colours (deduplicated).
      const merged = [...nativeResult.labels];
      for (const c of canvasColors) {
        if (!merged.includes(c)) merged.push(c);
      }
      labels  = merged;
      texts   = nativeResult.text;
      version = NATIVE_VERSION;
    } else {
      // Web: canvas colour extraction only.
      const canvasColors = await extractColorsFromUrl(dataUrl);
      labels  = canvasColors;
      version = canvasColors.length > 0 ? WEB_VERSION : WEB_SKIP;
    }

    // Write directly to DB without going through the React-Query layer
    // (the indexer runs outside React, and firing mutations here would
    //  cause spurious re-renders across the whole app).
    const db  = await getDB();
    const raw = await db.get("clothing_items", item.id);
    if (!raw) return;

    await db.put("clothing_items", {
      ...raw,
      visionLabels:  labels,
      visionText:    texts,
      visionVersion: version,
      updatedAt:     new Date().toISOString(),
    });
  } catch {
    // Fail silently — missing one item is non-fatal.
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

let _started = false;

/** Call once on app start.  Subsequent calls are no-ops. */
export async function startVisionIndexer(): Promise<void> {
  if (_started) return;
  _started = true;

  const isNative = Capacitor.isNativePlatform();

  // Load all items and filter those needing indexing.
  const db      = await getDB();
  const all     = (await db.getAll("clothing_items")) as ClothingItem[];
  const pending = all.filter((item) => needsIndexing(item, isNative));

  if (pending.length === 0) return;

  setIndexing(true);

  // Process one at a time to avoid hammering the main thread.
  for (const item of pending) {
    await processItem(item, isNative);
    await delay(INTER_ITEM_DELAY_MS);
  }

  // Also drain any items that were queued via scheduleItemForIndexing().
  while (_queue.length > 0) {
    const id   = _queue.shift()!;
    const raw  = await db.get("clothing_items", id) as ClothingItem | undefined;
    if (raw && needsIndexing(raw, isNative)) {
      await processItem(raw, isNative);
    }
  }

  setIndexing(false);
}

/**
 * Schedule a freshly-added/updated item for immediate analysis.
 * If the indexer loop is already running it will be picked up; otherwise
 * it is processed the next time the app starts and calls startVisionIndexer.
 */
export function scheduleItemForIndexing(id: number): void {
  if (!_queue.includes(id)) _queue.push(id);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
