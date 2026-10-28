// Main-thread side of the shared worker job protocol used by every engine:
//   → { id, type, ...payload }                     start a request
//   ← { id, type: 'progress', ratio, phase, ... }  any number of times
//   ← { id, type: 'result', ... } | { id, type: 'error', message, fatal }
// Cancel terminates the worker (the only way to stop WebAssembly mid-run); the
// next request starts a fresh worker. A crash (worker error, out of memory) fails
// the pending requests with a clear message and the worker is rebuilt on demand.
import { CancelledError } from './queue';
import { OUT_OF_MEMORY, isOutOfMemory } from '../device-limits.mjs';

export type Progress = { ratio?: number; phase?: string; [key: string]: unknown };

type Pending = {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  onProgress?: (p: Progress) => void;
};

export class WorkerCrashError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkerCrashError';
  }
}

export function createWorkerClient(
  make: () => Worker,
  options: { idleMs?: number; onRestart?: () => void } = {},
) {
  let worker: Worker | undefined;
  let next = 0;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const pending = new Map<number, Pending>();

  function failAll(error: Error) {
    for (const p of pending.values()) p.reject(error);
    pending.clear();
  }
  function stop() {
    worker?.terminate();
    worker = undefined;
    clearTimeout(idleTimer);
  }
  function crashed(message: string) {
    stop();
    failAll(
      new WorkerCrashError(
        isOutOfMemory(message) ? OUT_OF_MEMORY : message || 'The local engine stopped unexpectedly. Try again.',
      ),
    );
    options.onRestart?.();
  }
  function scheduleIdle() {
    clearTimeout(idleTimer);
    if (!options.idleMs || pending.size) return;
    idleTimer = setTimeout(stop, options.idleMs);
  }
  function ensure() {
    if (worker) return worker;
    const w = make();
    w.addEventListener('message', ({ data }) => {
      const p = pending.get(data?.id);
      if (!p) return;
      if (data.type === 'progress') return p.onProgress?.(data);
      pending.delete(data.id);
      if (data.type === 'error') {
        const error = new Error(data.message);
        if (data.fatal) {
          // The engine is unusable (aborted WebAssembly); start fresh next time.
          p.reject(isOutOfMemory(data.message) ? new Error(OUT_OF_MEMORY) : error);
          stop();
          failAll(new WorkerCrashError('The local engine restarted. Try again.'));
          return;
        }
        p.reject(error);
      } else p.resolve(data);
      scheduleIdle();
    });
    w.addEventListener('error', (event) => {
      event.preventDefault();
      crashed(event.message);
    });
    w.addEventListener('messageerror', () => crashed('The local engine could not read a message.'));
    worker = w;
    return w;
  }

  return {
    get alive() {
      return Boolean(worker);
    },
    request<T = any>(
      type: string,
      payload: Record<string, unknown> = {},
      opts: { transfer?: Transferable[]; onProgress?: (p: Progress) => void; signal?: AbortSignal } = {},
    ): Promise<T> {
      if (opts.signal?.aborted) return Promise.reject(new CancelledError());
      clearTimeout(idleTimer);
      const id = ++next;
      const w = ensure();
      return new Promise<T>((resolve, reject) => {
        const abort = () => {
          // Stopping WebAssembly means stopping the worker; other requests fail too.
          pending.delete(id);
          reject(new CancelledError());
          stop();
          failAll(new CancelledError());
        };
        opts.signal?.addEventListener('abort', abort, { once: true });
        pending.set(id, {
          resolve: (v) => {
            opts.signal?.removeEventListener('abort', abort);
            resolve(v);
          },
          reject: (e) => {
            opts.signal?.removeEventListener('abort', abort);
            reject(e);
          },
          onProgress: opts.onProgress,
        });
        w.postMessage({ id, type, ...payload }, opts.transfer || []);
      });
    },
    /** Frees the worker and its memory now. */
    stop,
  };
}
