import { removeBackground as imglyRemoveBackground } from "@imgly/background-removal";

/**
 * Configure ONNX Runtime Web to run inference in a Web Worker (proxy mode)
 * instead of blocking the main JS thread.
 *
 * Three-part fix required on iOS Safari / WKWebView:
 *
 * 1. Dynamic import — importing onnxruntime-web at module parse time triggers
 *    Vite pre-bundling mid-session, causing a full page reload that corrupts
 *    React's internal dispatcher. Importing inside the function ensures it only
 *    loads the moment inference is first requested, after everything is stable.
 *
 * 2. Object.defineProperty to lock proxy = true — imgly internally sets
 *    ort.env.wasm.proxy = false right before creating its inference session
 *    (it only enables the proxy when WebGPU is available, which it isn't on
 *    iOS Safari). A no-op setter silently ignores that write so the value
 *    stays true and ONNX runs inference in a sub-worker.
 *
 * 3. numThreads = 1 — iOS Safari has no SharedArrayBuffer, which WASM
 *    multithreading requires. Leaving threads > 1 causes a silent crash.
 */
let ortConfigured = false;

async function configureOrt(): Promise<void> {
  if (ortConfigured) return;
  ortConfigured = true;

  const ort = await import("onnxruntime-web");

  Object.defineProperty(ort.env.wasm, "proxy", {
    get: () => true,
    set: () => {}, // blocks imgly from setting it back to false
    configurable: true,
  });

  ort.env.wasm.numThreads = 1;
}

/**
 * Remove the background from a JPEG/PNG base64 data-URL.
 * Returns a PNG data-URL with transparent background.
 * On first ever call downloads ~15 MB ONNX model from imgly CDN (cached after that).
 * Throws on network error or unreadable image — callers should catch and fall back.
 */
export async function removeBackground(dataUrl: string): Promise<string> {
  await configureOrt();
  const sourceBlob = await dataUrlToBlob(dataUrl);
  const resultBlob = await imglyRemoveBackground(sourceBlob, {
    model: "isnet_fp16", // valid: "isnet" | "isnet_fp16" | "isnet_quint8" — NOT "small"/"medium"
    output: { format: "image/png", quality: 0.9 },
    // publicPath omitted → uses static imgly CDN automatically
  });
  return blobToDataUrl(resultBlob);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
