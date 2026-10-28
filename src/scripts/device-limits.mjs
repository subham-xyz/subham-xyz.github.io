// Real browser and device limits, used instead of product caps. KittySuite does
// not limit file size, page count or batch size; these values describe what the
// browser can actually hold, so a job fails with an honest message instead of a
// silent crash.

const SAFARI_CANVAS_AREA = 16_777_216; // 4096 × 4096: iOS and Safari canvases
const CHROMIUM_CANVAS_AREA = 268_435_456; // 16384 × 16384: Chrome, Edge, Firefox
export const MAX_CANVAS_SIDE = 16_384;

function env() {
  if (typeof navigator === 'undefined') return null;
  // Node has a navigator too; tests use the strictest real browser limit.
  return /^Node\.js/.test(navigator.userAgent || '') ? null : navigator;
}

/** True on iPhone/iPad and desktop Safari, whose canvases are much smaller. */
export function isSafariLike() {
  const nav = env();
  if (!nav) return true; // Node tests: use the strictest real limit.
  const ua = nav.userAgent || '';
  const ios =
    /iP(hone|ad|od)/.test(ua) ||
    (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  return ios || /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(ua);
}

/** Approximate device RAM in GB when the browser exposes it. */
export function deviceMemory() {
  const nav = env();
  return nav && typeof nav.deviceMemory === 'number' ? nav.deviceMemory : undefined;
}

/**
 * The largest image (in pixels) a canvas can hold here. Safari's limit is fixed;
 * elsewhere a low-memory device gets a lower ceiling (about 32 MP per GB of RAM)
 * so the tab is not killed, which is a runtime condition, not a product cap.
 */
export function canvasArea() {
  if (isSafariLike()) return SAFARI_CANVAS_AREA;
  const memory = deviceMemory();
  const byMemory = memory ? memory * 32_000_000 : CHROMIUM_CANVAS_AREA;
  return Math.max(SAFARI_CANVAS_AREA, Math.min(CHROMIUM_CANVAS_AREA, byMemory));
}

/** Whether width × height fits in a canvas on this device. */
export function fitsCanvas(width, height) {
  return (
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width >= 1 &&
    height >= 1 &&
    width <= MAX_CANVAS_SIDE &&
    height <= MAX_CANVAS_SIDE &&
    width * height <= canvasArea()
  );
}

export const megapixels = (pixels) => Math.floor(pixels / 1_000_000);

/** Message for an image that is larger than this browser can draw. */
export function canvasLimitMessage() {
  return `This size is larger than this browser can draw (about ${megapixels(canvasArea())} megapixels, ${MAX_CANVAS_SIDE.toLocaleString('en-US')} pixels per side). KittySuite does not limit image size; desktop Chrome, Edge or Firefox can handle bigger images, or resize the image first.`;
}

/** Browser errors that mean the device ran out of memory. */
export function isOutOfMemory(error) {
  if (error instanceof RangeError) return true;
  const text = String(error && error.message ? error.message : error);
  return /out of memory|allocation failed|array buffer allocation|invalid array length|cannot allocate|memory access out of bounds|NotReadableError|QuotaExceeded/i.test(
    text,
  );
}

export const OUT_OF_MEMORY =
  'Your browser ran out of available memory while processing this file. KittySuite does not impose a file-size limit. Try closing other tabs, or process this file on a desktop device.';
