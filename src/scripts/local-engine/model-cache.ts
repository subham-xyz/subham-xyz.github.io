// Downloads large self-hosted model files once and keeps them in Cache Storage, so later visits
// reuse them. Files over the host's per-file limit are stored as numbered parts and joined here.
import { throwIfCancelled } from './processing-errors';

const CACHE = 'kittysuite-models-v1';

export type Progress = (loaded: number, total: number, fromCache: boolean) => void;

async function openCache() {
  try {
    return typeof caches === 'object' ? await caches.open(CACHE) : undefined;
  } catch {
    return undefined; // private mode or storage disabled: download every time
  }
}

async function read(response: Response, onChunk: (bytes: number) => void, signal?: AbortSignal) {
  const reader = response.body?.getReader();
  if (!reader) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    onChunk(buffer.length);
    return [buffer];
  }
  const chunks: Uint8Array[] = [];
  for (;;) {
    throwIfCancelled(signal);
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    onChunk(value.length);
  }
  return chunks;
}

/**
 * Fetches every part (from cache when present), reporting combined progress, and returns them
 * joined into one buffer. `totalBytes` is the known combined size for accurate progress.
 */
export async function loadModel(
  parts: string[],
  totalBytes: number,
  onProgress?: Progress,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const cache = await openCache();
  const pieces: Uint8Array[] = [];
  let loaded = 0;
  let fromCache = true;
  for (const url of parts) {
    throwIfCancelled(signal);
    let response = await cache?.match(url);
    if (!response) {
      fromCache = false;
      response = await fetch(url, { signal });
      if (!response.ok) throw new Error(`Model download failed (HTTP ${response.status}).`);
      if (cache) {
        try {
          await cache.put(url, response.clone());
        } catch {
          // quota exceeded: keep going without caching this part
        }
      }
    }
    for (const chunk of await read(response, (n) => onProgress?.((loaded += n), totalBytes, fromCache), signal))
      pieces.push(chunk);
  }
  const joined = new Uint8Array(pieces.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const piece of pieces) {
    joined.set(piece, offset);
    offset += piece.length;
  }
  return joined;
}

/** True when every part is already stored, so the UI can say "ready" instead of "download". */
export async function isModelCached(parts: string[]) {
  const cache = await openCache();
  if (!cache) return false;
  for (const url of parts) if (!(await cache.match(url))) return false;
  return true;
}

export const megabytes = (bytes: number) => `${(bytes / 1048576).toFixed(bytes < 10 * 1048576 ? 1 : 0)} MB`;
