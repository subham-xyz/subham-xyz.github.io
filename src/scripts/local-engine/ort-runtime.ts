// Shared onnxruntime-web loader for the AI workers. The runtime is self-hosted under
// /local-engine/ort/ and imported at run time (not bundled), so its 11-22 MB WebAssembly
// file is downloaded only by tools that need it, and only once.
import type * as Ort from 'onnxruntime-web';

const ORT_DIR = '/local-engine/ort/';

async function runtime(gpu: boolean): Promise<typeof Ort> {
  const ort: typeof Ort = await import(/* @vite-ignore */ `${ORT_DIR}${gpu ? 'ort.webgpu.min.mjs' : 'ort.wasm.min.mjs'}`);
  ort.env.wasm.wasmPaths = ORT_DIR;
  // Threads need SharedArrayBuffer, which only cross-origin isolated pages get.
  ort.env.wasm.numThreads = (self as any).crossOriginIsolated ? Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2)) : 1;
  ort.env.logLevel = 'error';
  return ort;
}

export type Session = { session: Ort.InferenceSession; ort: typeof Ort; backend: 'webgpu' | 'wasm' };

/** Creates a session on WebGPU when asked and available, otherwise (or if that fails) on the CPU. */
export async function createSession(model: Uint8Array, gpu: boolean, onStatus?: (text: string) => void): Promise<Session> {
  if (gpu) {
    try {
      const ort = await runtime(true);
      const session = await ort.InferenceSession.create(model, { executionProviders: ['webgpu'], graphOptimizationLevel: 'all' });
      return { session, ort, backend: 'webgpu' };
    } catch {
      onStatus?.('Graphics acceleration is unavailable, so the CPU will be used (slower)...');
    }
  }
  const ort = await runtime(false);
  const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  return { session, ort, backend: 'wasm' };
}
