// Turns low-level failures (aborts, memory, WebGPU, network) into messages a person can act on.

export class CancelledError extends Error {
  constructor() {
    super('Cancelled. Nothing was saved.');
    this.name = 'CancelledError';
  }
}

export const isCancelled = (error: unknown) =>
  error instanceof CancelledError || (error instanceof DOMException && error.name === 'AbortError');

export function throwIfCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new CancelledError();
}

export function describeError(error: unknown, what = 'this file'): string {
  if (isCancelled(error)) return new CancelledError().message;
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/out of memory|allocation failed|Array buffer allocation|memory access out of bounds|RangeError: Invalid typed array length/i.test(message))
    return `Your device ran out of memory while processing ${what}. Try a smaller file, close other tabs, or use a desktop browser.`;
  if (/device (was )?lost|GPUDevice|webgpu/i.test(message))
    return 'The graphics processor stopped responding. Reload the page and try again; the tool will fall back to the CPU if the GPU keeps failing.';
  if (/Failed to fetch|NetworkError|Load failed|HTTP \d{3}/i.test(message))
    return 'A required local engine file could not be downloaded. Check your connection and try again. Your file was not sent anywhere.';
  if (error instanceof Error && message && message.length < 300) return message;
  return `${what[0].toUpperCase()}${what.slice(1)} could not be processed. Try a smaller, readable file or another browser.`;
}
