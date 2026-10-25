// What this browser and device can do for local processing. Decided from real
// feature checks (WebAssembly, workers, WebGPU adapter, memory hints), never screen width.

export type Capabilities = {
  wasm: boolean;
  simd: boolean;
  workers: boolean;
  webgpu: boolean;
  threads: number;
  /** GB of RAM reported by navigator.deviceMemory (Chromium only, capped at 8); undefined elsewhere. */
  memory?: number;
  mobile: boolean;
  /** Cache Storage is available (secure context), so models can be kept between visits. */
  cache: boolean;
};

/** Level 1 runs on most devices, level 2 prefers WebGPU, level 3 is desktop-focused AI. */
export type Level = 'local' | 'local-ai' | 'desktop-ai';

export type Verdict = {
  /** Processing can run in this browser at all. */
  supported: boolean;
  /** Shown instead of the tool when unsupported, or above it as a recommendation. */
  message?: string;
  /** Short badge text for the current device. */
  badge: string;
};

// Smallest valid module using a v128 instruction; validates only where WebAssembly SIMD exists.
const SIMD_PROBE = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
]);

let cached: Promise<Capabilities> | undefined;

async function hasWebGPU() {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu) return false;
  try {
    return Boolean(await gpu.requestAdapter());
  } catch {
    return false;
  }
}

function isMobile() {
  const hints = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (typeof hints?.mobile === 'boolean') return hints.mobile;
  return matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
}

export function getLocalCapabilities(): Promise<Capabilities> {
  cached ||= (async () => {
    const wasm = typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
    let simd = false;
    try {
      simd = wasm && WebAssembly.validate(SIMD_PROBE);
    } catch {}
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    return {
      wasm,
      simd,
      workers: typeof Worker === 'function',
      webgpu: await hasWebGPU(),
      threads: navigator.hardwareConcurrency || 2,
      memory: typeof memory === 'number' ? memory : undefined,
      mobile: isMobile(),
      cache: typeof caches === 'object' && isSecureContext,
    };
  })();
  return cached;
}

const UNSUPPORTED =
  'This browser cannot run the local engine (WebAssembly and Web Workers are required). Try a current version of Chrome, Edge, Firefox or Safari.';

/** Whether a tool of the given level should run here, and what to tell the user. */
export function assess(level: Level, caps: Capabilities): Verdict {
  if (!caps.wasm || !caps.workers) return { supported: false, message: UNSUPPORTED, badge: 'Unsupported' };
  if (level === 'local') return { supported: true, badge: 'Local' };
  const lowMemory = caps.memory !== undefined && caps.memory < 4;
  if (level === 'local-ai') {
    if (caps.mobile || lowMemory)
      return {
        supported: true,
        badge: 'Desktop recommended',
        message:
          'This tool works best on a desktop browser because the AI model runs on your own hardware. It may be slow or run out of memory on this device.',
      };
    return { supported: true, badge: caps.webgpu ? 'Local AI · GPU' : 'Local AI' };
  }
  if (caps.mobile || lowMemory || !caps.webgpu)
    return {
      supported: false,
      badge: 'Desktop AI',
      message:
        "This tool currently works best on a desktop browser because processing runs locally using your computer's hardware. Open this page in Chrome or Edge on a computer.",
    };
  return { supported: true, badge: 'Desktop AI' };
}
