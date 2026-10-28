// A batch queue for any tool: per-item status and progress, a concurrency that
// fits the device, cancel one or all, pause and resume between items, and retry
// of failed items. One failure never stops the rest of the batch.
// No batch-size limit: items are processed as the device allows.

export type JobStatus =
  | 'queued'
  | 'running'
  | 'done'
  | 'failed'
  | 'cancelled';

export type JobContext = {
  signal: AbortSignal;
  /** ratio 0–1 (or undefined while unknown) and a short phase label. */
  progress(ratio: number | undefined, phase?: string): void;
};

export type JobItem<I, O> = {
  id: number;
  input: I;
  status: JobStatus;
  ratio?: number;
  phase?: string;
  output?: O;
  error?: unknown;
  attempts: number;
};

export type Runner<I, O> = (input: I, ctx: JobContext) => Promise<O>;

export class CancelledError extends Error {
  constructor() {
    super('Cancelled.');
    this.name = 'CancelledError';
  }
}
export const isCancelled = (error: unknown) =>
  error instanceof CancelledError ||
  (error instanceof DOMException && error.name === 'AbortError');

export class JobQueue<I, O> {
  readonly items: JobItem<I, O>[] = [];
  private controllers = new Map<number, AbortController>();
  private next = 0;
  private paused = false;
  private idleWaiters: (() => void)[] = [];
  private listeners = new Set<(queue: JobQueue<I, O>) => void>();

  private run: Runner<I, O>;
  concurrency: number;

  constructor(run: Runner<I, O>, concurrency = 1) {
    this.run = run;
    this.concurrency = concurrency;
  }

  /** Subscribe to every change (status, progress). Returns an unsubscribe. */
  onChange(fn: (queue: JobQueue<I, O>) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const fn of this.listeners) fn(this);
  }

  add(inputs: I[]) {
    const added = inputs.map((input) => ({
      id: ++this.next,
      input,
      status: 'queued' as JobStatus,
      attempts: 0,
    }));
    this.items.push(...added);
    this.emit();
    this.pump();
    return added;
  }

  get running() {
    return this.items.filter((i) => i.status === 'running').length;
  }
  get isPaused() {
    return this.paused;
  }
  get isIdle() {
    return !this.items.some(
      (i) => i.status === 'queued' || i.status === 'running',
    );
  }
  counts() {
    const c = { queued: 0, running: 0, done: 0, failed: 0, cancelled: 0 };
    for (const item of this.items) c[item.status]++;
    return c;
  }
  /** Overall progress across the batch, 0–1. */
  overall() {
    const active = this.items.filter((i) => i.status !== 'cancelled');
    if (!active.length) return 0;
    const sum = active.reduce(
      (n, i) =>
        n +
        (i.status === 'done' || i.status === 'failed'
          ? 1
          : i.status === 'running'
            ? i.ratio || 0
            : 0),
      0,
    );
    return sum / active.length;
  }

  /** Stops starting new items. A running item finishes (engines cannot pause mid-encode). */
  pause() {
    this.paused = true;
    this.emit();
  }
  resume() {
    this.paused = false;
    this.emit();
    this.pump();
  }
  cancel(id: number) {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;
    if (item.status === 'queued') item.status = 'cancelled';
    this.controllers.get(id)?.abort();
    this.emit();
    this.settle();
  }
  cancelAll() {
    for (const item of this.items)
      if (item.status === 'queued') item.status = 'cancelled';
    for (const controller of this.controllers.values()) controller.abort();
    this.emit();
    this.settle();
  }
  retry(id: number) {
    const item = this.items.find((i) => i.id === id);
    if (!item || !['failed', 'cancelled'].includes(item.status)) return;
    item.status = 'queued';
    item.error = undefined;
    item.ratio = undefined;
    this.emit();
    this.pump();
  }
  retryFailed() {
    for (const item of this.items)
      if (item.status === 'failed') {
        item.status = 'queued';
        item.error = undefined;
        item.ratio = undefined;
      }
    this.emit();
    this.pump();
  }
  remove(id: number) {
    const index = this.items.findIndex((i) => i.id === id);
    if (index < 0 || this.items[index].status === 'running') return;
    this.items.splice(index, 1);
    this.emit();
    this.settle();
  }
  clear() {
    this.cancelAll();
    this.items.splice(0, this.items.length);
    this.emit();
  }
  /** Resolves when nothing is queued or running. */
  whenIdle() {
    if (this.isIdle) return Promise.resolve();
    return new Promise<void>((resolve) => this.idleWaiters.push(resolve));
  }
  results() {
    return this.items.filter((i) => i.status === 'done').map((i) => i.output!);
  }

  private settle() {
    if (!this.isIdle) return;
    const waiters = this.idleWaiters.splice(0);
    for (const resolve of waiters) resolve();
  }

  private pump() {
    while (!this.paused && this.running < this.concurrency) {
      const item = this.items.find((i) => i.status === 'queued');
      if (!item) break;
      void this.start(item);
    }
    this.settle();
  }

  private async start(item: JobItem<I, O>) {
    const controller = new AbortController();
    this.controllers.set(item.id, controller);
    item.status = 'running';
    item.attempts++;
    item.ratio = 0;
    this.emit();
    let last = 0;
    try {
      const output = await this.run(item.input, {
        signal: controller.signal,
        progress: (ratio, phase) => {
          item.ratio = ratio;
          if (phase) item.phase = phase;
          // Progress is throttled to keep the page responsive.
          const now = performance.now();
          if (now - last > 120 || ratio === 1) {
            last = now;
            this.emit();
          }
        },
      });
      if (controller.signal.aborted) throw new CancelledError();
      item.output = output;
      item.status = 'done';
      item.ratio = 1;
    } catch (error) {
      item.error = error;
      item.status =
        controller.signal.aborted || isCancelled(error) ? 'cancelled' : 'failed';
    } finally {
      this.controllers.delete(item.id);
      this.emit();
      this.pump();
    }
  }
}
