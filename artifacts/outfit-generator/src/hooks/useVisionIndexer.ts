/**
 * useVisionIndexer — React hook that starts the background vision indexer
 * and exposes its running state so the UI can show a progress hint.
 *
 * Mount this once in the app shell.  Subsequent mounts (after HMR, StrictMode
 * double-invoke, etc.) are safe — startVisionIndexer() is idempotent.
 */

import { useEffect, useState } from "react";
import { startVisionIndexer, subscribeIndexerState } from "@/lib/visionIndexer";

export function useVisionIndexer(): { isIndexing: boolean } {
  const [isIndexing, setIsIndexing] = useState(false);

  useEffect(() => {
    // Subscribe first so we don't miss the initial state change.
    const unsubscribe = subscribeIndexerState(setIsIndexing);

    // Start indexing — no-op if already started.
    startVisionIndexer().catch(console.warn);

    return unsubscribe;
  }, []);

  return { isIndexing };
}
