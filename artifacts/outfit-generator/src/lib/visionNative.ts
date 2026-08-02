/**
 * visionNative — wrapper around the custom VisionPlugin Capacitor plugin.
 *
 * The plugin (VisionPlugin.swift + VisionPlugin.m) runs Apple Vision on a
 * background queue and returns labels + OCR text for a given image data URL.
 * Falls back silently to empty arrays on any error so the rest of the app
 * always gets a usable result.
 */

import { registerPlugin } from "@capacitor/core";

interface VisionPluginInterface {
  analyzeImage(options: { dataUrl: string }): Promise<{ labels: string[]; text: string[] }>;
}

const VisionPlugin = registerPlugin<VisionPluginInterface>("VisionPlugin");

export async function analyzeImageNative(
  dataUrl: string,
): Promise<{ labels: string[]; text: string[] }> {
  try {
    return await VisionPlugin.analyzeImage({ dataUrl });
  } catch {
    return { labels: [], text: [] };
  }
}
