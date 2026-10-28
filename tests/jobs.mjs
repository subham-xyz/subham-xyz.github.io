// Shared job queue: concurrency, pause/resume, cancel, retry, per-item failure.
// Run: node tests/jobs.mjs (Node 22.6+ with type stripping)
import assert from 'node:assert/strict';
import { JobQueue, CancelledError } from '../src/scripts/jobs/queue.ts';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let running = 0;
let peak = 0;
const runner = async (input, { signal, progress }) => {
  running++;
  peak = Math.max(peak, running);
  try {
    for (let i = 1; i <= 4; i++) {
      await wait(5);
      if (signal.aborted) throw new CancelledError();
      progress(i / 4, 'processing');
    }
    if (input === 'bad') throw new Error('broken file');
    return input.toUpperCase();
  } finally {
    running--;
  }
};

// Batch with one failure: the others still finish; concurrency is respected.
const q = new JobQueue(runner, 2);
let changes = 0;
q.onChange(() => changes++);
q.add(['a', 'bad', 'c', 'd', 'e']);
await q.whenIdle();
assert.equal(peak, 2);
assert.deepEqual(q.results(), ['A', 'C', 'D', 'E']);
assert.deepEqual(q.counts(), { queued: 0, running: 0, done: 4, failed: 1, cancelled: 0 });
assert.equal(q.items[1].error.message, 'broken file');
assert.ok(changes > 5);
assert.equal(q.overall(), 1);

// Retry a failed item (it fails again here, but it is retried).
q.retry(q.items[1].id);
assert.equal(q.items[1].status, 'running');
await q.whenIdle();
assert.equal(q.items[1].attempts, 2);

// Pause stops new items; resume continues; nothing is lost.
const p = new JobQueue(runner, 1);
p.add(['x', 'y', 'z']);
p.pause();
await wait(40);
assert.equal(p.counts().done, 1); // the running item finishes
assert.equal(p.counts().queued, 2);
p.resume();
await p.whenIdle();
assert.deepEqual(p.results(), ['X', 'Y', 'Z']);

// Cancel one queued item and one running item; cancel all.
const c = new JobQueue(runner, 1);
const [first, second, third] = c.add(['1', '2', '3']);
c.cancel(second.id);
await wait(8);
c.cancel(first.id);
await c.whenIdle();
assert.equal(first.status, 'cancelled');
assert.equal(second.status, 'cancelled');
assert.equal(third.status, 'done');
const all = new JobQueue(runner, 2);
all.add(['m', 'n', 'o', 'p']);
await wait(8);
all.cancelAll();
await all.whenIdle();
assert.equal(all.counts().done, 0);
assert.equal(all.counts().cancelled, 4);

// No batch limit: a large batch is accepted and processed.
const big = new JobQueue(async (n) => n * 2, 4);
big.add(Array.from({ length: 2000 }, (_, i) => i));
await big.whenIdle();
assert.equal(big.results().length, 2000);

console.log('PASS: job queue (concurrency, failures, retry, pause/resume, cancel one/all, large batches).');
