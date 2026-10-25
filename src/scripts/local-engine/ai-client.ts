// Main-thread client for an AI worker (load model once, run jobs, cancel by terminating).
import { CancelledError } from './processing-errors';

export type AIEvents = {
  onProgress?: (loaded: number, total: number, fromCache: boolean) => void;
  onStatus?: (text: string) => void;
  onTile?: (done: number, total: number) => void;
};

export function createAIClient(make: () => Worker, events: AIEvents = {}) {
  let worker: Worker | undefined;
  let backend = '';
  let next = 0;
  let pending: { reject: (e: Error) => void } | undefined;

  function stop() {
    worker?.terminate();
    worker = undefined;
    backend = '';
  }
  const start = () => {
    worker = make();
    worker.addEventListener('message', ({ data }) => {
      if (data.type === 'progress') events.onProgress?.(data.loaded, data.total, data.fromCache);
      if (data.type === 'status') events.onStatus?.(data.text);
      if (data.type === 'tile') events.onTile?.(data.done, data.total);
    });
    worker.addEventListener('error', (event) => {
      pending?.reject(new Error(event.message || 'The local AI engine stopped unexpectedly.'));
      stop();
    });
    return worker;
  };
  function request<T>(message: any, accept: (data: any) => T | undefined, transfer: Transferable[] = []) {
    return new Promise<T>((resolve, reject) => {
      const w = worker || start();
      pending = { reject };
      const listener = ({ data }: MessageEvent) => {
        const failed = data.type === 'error' && (data.id === undefined || data.id === message.id);
        const value = failed ? undefined : accept(data);
        if (!failed && value === undefined) return;
        w.removeEventListener('message', listener);
        pending = undefined;
        if (failed) reject(new Error(data.message));
        else resolve(value as T);
      };
      w.addEventListener('message', listener);
      w.postMessage(message, transfer);
    });
  }
  return {
    get backend() {
      return backend;
    },
    async load(gpu: boolean) {
      if (backend) return backend;
      backend = await request<string>({ type: 'load', gpu }, (d) => (d.type === 'ready' ? d.backend : undefined));
      return backend;
    },
    /** Sends one job; `type` is the reply message type that carries the result. */
    run<T>(payload: Record<string, unknown>, type: string, transfer: Transferable[] = []) {
      const id = ++next;
      return request<T>({ type: 'run', id, ...payload }, (d) => (d.type === type && d.id === id ? d : undefined), transfer);
    },
    /** Stops the worker at once (cancels a download or a running job) and frees its memory. */
    cancel() {
      pending?.reject(new CancelledError());
      pending = undefined;
      stop();
    },
    stop,
  };
}
