// The small API every media recipe uses, independent of where FFmpeg runs
// (the browser worker or a Node test). Progress across several FFmpeg commands
// is weighted into one 0–1 bar.
import { explain, MediaError } from './media-errors.mjs';

/**
 * backend: {
 *   exec(args, outputs) -> Promise<{ ret, log }>   (throws on engine crash)
 *   write(path, data) -> Promise
 *   remove(names) -> Promise
 *   collect(names) -> Promise<File-like[]>         (moves finished outputs off the engine)
 *   list() -> Promise<string[]>                     (files in /out)
 * }
 * inputs: [{ name, info }]  (mounted at /in/<name>)
 */
/**
 * @param {any} backend
 * @param {{ inputs?: any[], onProgress?: (ratio: number, phase: any) => void, signal?: AbortSignal }} [options]
 */
export function createContext(backend, { inputs, onProgress: report = () => {}, signal } = {}) {
  let total = 1;
  let shown = 0;
  // Progress never moves backwards (FFmpeg's clock can jump between streams).
  const onProgress = (ratio, phase) => {
    shown = Math.max(shown, Math.min(1, ratio));
    report(shown, phase);
  };
  let done = 0;
  let announced = [];
  const temporary = new Set();
  const collected = [];
  const check = () => {
    if (signal?.aborted) throw Object.assign(new Error('Cancelled.'), { name: 'CancelledError' });
  };
  const ctx = {
    inputs: inputs.map((input) => ({ ...input, path: input.path || `/in/${input.name}` })),
    get input() {
      return ctx.inputs[0];
    },
    log: '',
    /** Declares how many weighted steps the recipe will run (for progress). */
    steps(n) {
      total = Math.max(1, n);
    },
    /** A final output file in /out (written to disk when the browser allows). */
    out(name) {
      announced.push(name);
      return `/out/${name}`;
    },
    /** An intermediate file in /out, deleted when the job ends. */
    tmp(name) {
      temporary.add(name);
      return ctx.out(name);
    },
    /** A file shipped with the site (for example a font), as bytes. */
    asset(path) {
      return backend.asset(path);
    },
    async write(path, data) {
      check();
      await backend.write(path, data);
    },
    async remove(...names) {
      for (const name of names) temporary.delete(name);
      await backend.remove(names);
    },
    /**
     * Runs one FFmpeg command. `duration` (seconds of output) turns FFmpeg's
     * time readings into progress; `weight` is this step's share of the job.
     */
    async exec(args, { duration, weight = 1, phase = 'processing', allowFail = false } = {}) {
      check();
      const outputs = announced;
      announced = [];
      onProgress((done) / total, phase);
      const result = await backend.exec(args, outputs, (time) => {
        if (duration > 0) onProgress((done + weight * Math.min(1, time / duration)) / total, phase);
      });
      ctx.log = result.log || '';
      if (result.ret !== 0) {
        if (allowFail) return false;
        throw new MediaError(explain(ctx.log), ctx.log);
      }
      done += weight;
      onProgress(done / total, phase);
      return true;
    },
    /** Names of files currently in /out (frame sequences, segments). */
    async listOut() {
      return (await backend.list()).filter((n) => !temporary.has(n));
    },
    /**
     * Moves finished outputs off the engine now (frees memory in long jobs).
     * `{ jpeg: true }`: the outputs are PNG and are saved as JPG by the host.
     */
    async collect(names, options = {}) {
      collected.push(...(await backend.collect(names, options)));
    },
    async finish(names, options = {}) {
      if (names.length) await ctx.collect(names, options);
      if (temporary.size) await backend.remove([...temporary]);
      return collected;
    },
  };
  return ctx;
}
