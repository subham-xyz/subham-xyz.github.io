// Which FFmpeg build the media engine runs, chosen per device at load time.
//
//   multi-thread   @ffmpeg/core-mt (WASM threads + SharedArrayBuffer). Needs a
//                  cross-origin isolated page: production (Cloudflare Pages)
//                  sends COOP: same-origin + COEP: require-corp (public/_headers).
//   single-thread  @ffmpeg/core. Works everywhere: GitHub Pages previews (no
//                  custom headers), browsers without SharedArrayBuffer, and
//                  low-memory phones, where many threads cost more than they gain.
//
// Tools never see the difference: both run the same recipes through engine.ts.
// If the multi-thread engine fails to start or crashes, this tab switches to
// the single-thread engine for the rest of the session.

export const MULTI_THREAD_DEPLOYED = true; // copied by scripts/copy-local-engine-assets.mjs
const BROKEN_KEY = 'kittysuite-ffmpeg-mt-failed';
let broken = false;

export function markMultiThreadBroken() {
  broken = true;
  try {
    sessionStorage.setItem(BROKEN_KEY, '1');
  } catch {
    // storage blocked: the in-memory flag still applies to this page
  }
}

function previouslyBroken() {
  try {
    return sessionStorage.getItem(BROKEN_KEY) === '1';
  } catch {
    return false;
  }
}

/** Whether this browser can run threaded WebAssembly at all. */
export function threadsAvailable() {
  return (
    globalThis.crossOriginIsolated === true &&
    typeof SharedArrayBuffer === 'function' &&
    typeof Atomics === 'object' &&
    typeof Worker === 'function'
  );
}

/**
 * @param {{ tier?: string, cores?: number }} [device]  from jobs/device.ts
 * @returns {'multi-thread' | 'single-thread'}
 */
export function engineVariant(device = {}) {
  if (!MULTI_THREAD_DEPLOYED || broken || previouslyBroken() || !threadsAvailable()) return 'single-thread';
  if (device.tier === 'low-memory-mobile' || (device.cores ?? 2) < 2) return 'single-thread';
  return 'multi-thread';
}

/**
 * Threads for the multi-thread engine: up to 4 on phones and tablets, up to 8
 * on computers. (Its WebAssembly memory is fixed at 1 GB by the build: shared
 * memory cannot grow. Inputs are streamed from the person's files and outputs
 * go to disk, so that is working memory only. A device that cannot reserve it
 * falls back to the single-thread engine.)
 * @param {{ mobile?: boolean, cores?: number }} [device]
 */
export function threadPlan(device = {}) {
  const cores = Math.max(1, device.cores || 2);
  return { threads: device.mobile ? Math.min(4, cores) : Math.min(8, cores) };
}

export function engineDir(variant = engineVariant()) {
  return variant === 'multi-thread' ? '/local-engine/ffmpeg-mt/' : '/local-engine/ffmpeg/';
}
