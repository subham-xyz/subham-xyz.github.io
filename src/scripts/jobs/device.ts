// What this browser and device can do, used to choose HOW a job runs (in a
// worker, on disk, one at a time), never to refuse a file. KittySuite has no
// size, duration or batch limits; these hints only pick the safest strategy.
import { deviceMemory, isSafariLike } from '../device-limits.mjs';

export type Tier =
  | 'low-memory-mobile'
  | 'mobile'
  | 'desktop'
  | 'high-memory-desktop';

export type Device = {
  tier: Tier;
  mobile: boolean;
  /** RAM in GB when the browser reports it (Chromium only, capped at 8). */
  memory?: number;
  cores: number;
  workers: boolean;
  wasm: boolean;
  /** Origin Private File System: temporary files live on disk, not in RAM. */
  opfs: boolean;
  /**
   * Synchronous OPFS access in workers (engines write straight to disk). Browsers
   * expose it only inside workers, so this is a best guess on the page; the
   * media worker verifies it before use.
   */
  opfsSync: boolean;
  /** Cross-origin isolation: SharedArrayBuffer and threaded WebAssembly. */
  isolated: boolean;
  webcodecs: boolean;
  webgpu: boolean;
  /** navigator.share can send files (most phones). */
  shareFiles: boolean;
  /** showSaveFilePicker (desktop Chromium). */
  savePicker: boolean;
};

let cached: Device | undefined;

function isMobile() {
  const hints = (
    navigator as Navigator & { userAgentData?: { mobile?: boolean } }
  ).userAgentData;
  if (typeof hints?.mobile === 'boolean') return hints.mobile;
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
    (matchMedia('(pointer: coarse)').matches &&
      !matchMedia('(any-pointer: fine)').matches)
  );
}

function canShareFiles() {
  try {
    return (
      typeof navigator.canShare === 'function' &&
      navigator.canShare({
        files: [new File([''], 'test.txt', { type: 'text/plain' })],
      })
    );
  } catch {
    return false;
  }
}

export function device(): Device {
  if (cached) return cached;
  const memory = deviceMemory();
  const mobile = isMobile();
  const cores = Math.max(1, navigator.hardwareConcurrency || 2);
  // iPhones do not report memory; treat them as phones with ordinary memory.
  const lowMemory = memory !== undefined ? memory <= 3 : mobile && cores <= 4;
  const tier: Tier = mobile
    ? lowMemory
      ? 'low-memory-mobile'
      : 'mobile'
    : memory !== undefined && memory >= 8 && cores >= 8
      ? 'high-memory-desktop'
      : 'desktop';
  const opfs =
    typeof navigator.storage === 'object' &&
    typeof navigator.storage.getDirectory === 'function';
  cached = {
    tier,
    mobile,
    memory,
    cores,
    workers: typeof Worker === 'function',
    wasm: typeof WebAssembly === 'object',
    opfs,
    opfsSync:
      opfs &&
      typeof FileSystemFileHandle === 'function' &&
      ('createSyncAccessHandle' in FileSystemFileHandle.prototype ||
        // Chromium and Firefox expose it to workers only; Safari 15.2+ too.
        typeof Worker === 'function'),
    isolated: globalThis.crossOriginIsolated === true,
    webcodecs: typeof (globalThis as any).VideoEncoder === 'function',
    webgpu: 'gpu' in navigator,
    shareFiles: canShareFiles(),
    savePicker: typeof (window as any).showSaveFilePicker === 'function',
  };
  return cached;
}

/**
 * How many jobs may run at once. Heavy jobs (media encoding, OCR) hold large
 * buffers, so phones run them one by one; light jobs scale with the CPU.
 */
export function concurrency(kind: 'light' | 'heavy' = 'light') {
  const d = device();
  if (kind === 'heavy') return d.tier === 'high-memory-desktop' ? 2 : 1;
  if (d.tier === 'low-memory-mobile') return 1;
  if (d.mobile) return 2;
  return Math.min(4, Math.max(1, Math.floor(d.cores / 2)));
}

/** Phones and Safari get engines unloaded after each job to give memory back. */
export function releaseEnginesAfterJobs() {
  const d = device();
  return d.tier === 'low-memory-mobile' || (d.mobile && isSafariLike());
}
