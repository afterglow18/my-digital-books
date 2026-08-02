/**
 * visionWeb — canvas-based dominant-colour extractor for web/browser.
 *
 * Algorithm:
 *  1. Draw the image to a 48×48 canvas.
 *  2. Sample 4×4 pixel patches from each corner (16 pixels/corner) to detect
 *     the background colour (studio white, beige, grey …).
 *  3. Exclude any pixel whose colour is within a Euclidean distance of 40
 *     from the background median — this prevents studio backgrounds polluting
 *     the results.
 *  4. Map surviving foreground pixels to one of 15 named colours.
 *  5. Return names that cover ≥ 10 % of foreground pixels.
 */

const CANVAS_SIZE = 48;
const BG_PATCH    = 4;   // sample a 4×4 patch from each corner
const BG_DIST_SQ  = 40 * 40; // squared distance threshold for background exclusion
const MIN_FRACTION = 0.10;   // a colour must cover ≥ 10 % of foreground pixels

// ── Colour classification ─────────────────────────────────────────────────────

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function getHue(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;
  let h = 0;
  if      (max === r) h = ((g - b) / delta) % 6;
  else if (max === g) h = (b - r) / delta + 2;
  else                h = (r - g) / delta + 4;
  return ((h * 60) + 360) % 360;
}

function getSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function classifyPixel(r: number, g: number, b: number): string {
  const lum = luminance(r, g, b);
  if (lum < 80)  return "black";
  if (lum < 110) return "dark grey";
  if (lum < 175) return "grey";

  const sat = getSaturation(r, g, b);
  if (sat < 0.18) {
    if (lum < 225) return "light grey";
    return "white";
  }

  const hue = getHue(r, g, b);

  // Warm neutrals (brownish hues, moderate saturation)
  if (hue >= 20 && hue < 45) {
    if (sat < 0.35)       return lum > 180 ? "beige" : "tan";
    if (lum < 130)        return "brown";
    return lum > 180 ? "tan" : "brown";
  }

  if (hue >= 345 || hue < 20)  return "red";
  if (hue >= 20  && hue < 45)  return "orange";
  if (hue >= 45  && hue < 70)  return "yellow";
  if (hue >= 70  && hue < 160) return "green";
  if (hue >= 160 && hue < 200) return "teal";
  if (hue >= 200 && hue < 260) return "blue";
  if (hue >= 260 && hue < 290) return "purple";
  if (hue >= 290 && hue < 345) return "pink";

  return "grey";
}

// ── Background detection ──────────────────────────────────────────────────────

function cornerMedian(data: Uint8ClampedArray, w: number, h: number): [number, number, number] {
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];

  const corners = [
    [0, 0], [w - BG_PATCH, 0],
    [0, h - BG_PATCH], [w - BG_PATCH, h - BG_PATCH],
  ];

  for (const [cx, cy] of corners) {
    for (let y = cy; y < cy + BG_PATCH && y < h; y++) {
      for (let x = cx; x < cx + BG_PATCH && x < w; x++) {
        const i = (y * w + x) * 4;
        rs.push(data[i]); gs.push(data[i + 1]); bs.push(data[i + 2]);
      }
    }
  }

  const med = (arr: number[]) => {
    arr.sort((a, b) => a - b);
    return arr[Math.floor(arr.length / 2)];
  };

  return [med(rs), med(gs), med(bs)];
}

function distSq(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Extracts dominant foreground colour names from an image URL.
 * Returns an empty array if the image cannot be loaded or the canvas API is unavailable.
 */
export async function extractColorsFromUrl(imageUrl: string): Promise<string[]> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") { resolve([]); return; }

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onerror = () => resolve([]);

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width  = CANVAS_SIZE;
        canvas.height = CANVAS_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve([]); return; }

        ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
        const { data } = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        const [bgR, bgG, bgB] = cornerMedian(data, CANVAS_SIZE, CANVAS_SIZE);

        const counts: Record<string, number> = {};
        let foreground = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 128) continue; // skip transparent
          if (distSq(r, g, b, bgR, bgG, bgB) < BG_DIST_SQ) continue; // skip background

          foreground++;
          const name = classifyPixel(r, g, b);
          counts[name] = (counts[name] ?? 0) + 1;
        }

        if (foreground === 0) { resolve([]); return; }

        const results = Object.entries(counts)
          .filter(([, n]) => n / foreground >= MIN_FRACTION)
          .sort(([, a], [, b]) => b - a)
          .map(([name]) => name);

        resolve(results);
      } catch {
        resolve([]);
      }
    };

    img.src = imageUrl;
  });
}
