// The one media engine every video, audio and GIF tool uses. It owns a single
// FFmpeg worker (loaded on first use, cached on the device), runs one job at a
// time, and recycles the worker after a crash, after a dozen jobs, or after
// every job on low-memory phones, so memory is given back.
import { createWorkerClient, WorkerCrashError } from '../jobs/worker-client';
import { CancelledError, isCancelled } from '../jobs/queue';
import { device, releaseEnginesAfterJobs } from '../jobs/device';
import { cleanupStale, getFile, putFile, removeFile, sessionName, tempDir } from '../jobs/temp-store';
import { createContext } from './recipe-context.mjs';
import { recipes, mimeFor } from './recipes.mjs';
import { mediaInfo } from './probe.mjs';
import { MediaError } from './media-errors.mjs';
import { OUT_OF_MEMORY } from '../device-limits.mjs';
import { engineDir, engineVariant, markMultiThreadBroken, threadPlan } from './variant.mjs';

// Single-thread FFmpeg by default; see variant.mjs for the multi-threaded build.
export { engineVariant };
// Download size of the gzip-compressed engine (used until the server reports one).
export const ENGINE_BYTES = 10_272_200;
const RECYCLE_AFTER = 12;

/** PNG to JPEG with the browser's encoder; transparent areas become black. */
async function pngToJpeg(file: Blob, quality = 0.92): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    if (typeof OffscreenCanvas === 'function') {
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const g = canvas.getContext('2d')!;
      g.fillStyle = '#000';
      g.fillRect(0, 0, bitmap.width, bitmap.height);
      g.drawImage(bitmap, 0, 0);
      return await canvas.convertToBlob({ type: 'image/jpeg', quality });
    }
    const canvas = Object.assign(document.createElement('canvas'), { width: bitmap.width, height: bitmap.height });
    const g = canvas.getContext('2d')!;
    g.fillStyle = '#000';
    g.fillRect(0, 0, bitmap.width, bitmap.height);
    g.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    canvas.width = canvas.height = 0;
    if (!blob) throw new Error('This browser could not save the frame as JPG. Choose PNG instead.');
    return blob;
  } finally {
    bitmap.close();
  }
}

export type Phase =
  | 'engine'
  | 'engine-cached'
  | 'engine-start'
  | 'reading'
  | 'analyzing'
  | 'processing'
  | 'encoding'
  | 'writing'
  | 'packing';
export type OnProgress = (ratio: number | undefined, phase: Phase, detail?: { loaded?: number; total?: number }) => void;

let client: ReturnType<typeof createWorkerClient> | undefined;
let loaded: Promise<string> | undefined;
/** The engine build running now ('multi-thread' or 'single-thread'). */
let running = '';
let jobs = 0;
let counter = 0;
let busy: Promise<unknown> = Promise.resolve();

function worker() {
  client ||= createWorkerClient(
    () => new Worker(new URL('./ffmpeg.worker.ts', import.meta.url), { type: 'module', name: 'kittysuite-media' }),
    { idleMs: 4 * 60_000, onRestart: () => (loaded = undefined) },
  );
  if (!client.alive) loaded = undefined;
  return client;
}

/** Stops the engine and frees its memory now (next job reloads it from cache). */
export function releaseEngine() {
  client?.stop();
  loaded = undefined;
}

/** The engine build this device would use (for diagnostics and messages). */
export const selectedVariant = () => engineVariant(device());

function start(variant: 'multi-thread' | 'single-thread', onProgress?: OnProgress, signal?: AbortSignal) {
  const dir = engineDir(variant);
  const plan = threadPlan(device());
  return worker()
    .request<{ variant: string }>(
      'load',
      {
        variant,
        threads: plan.threads,
        coreURL: new URL(`${dir}ffmpeg-core.js`, location.href).href,
        wasmURL: new URL(`${dir}ffmpeg-core.wasm.gz`, location.href).href,
      },
      {
          signal,
          onProgress: (p) =>
            onProgress?.(
              p.total ? Number(p.loaded) / Number(p.total) : undefined,
              (p.phase as Phase) || 'engine',
              { loaded: Number(p.loaded) || 0, total: Number(p.total) || ENGINE_BYTES },
            ),
      },
    )
    .then((r) => (running = r.variant));
}

/**
 * Downloads (first time) and starts the best engine for this device: the
 * multi-thread build when the page is cross-origin isolated, otherwise the
 * single-thread build. A multi-thread engine that fails to start falls back.
 */
export function loadEngine(onProgress?: OnProgress, signal?: AbortSignal) {
  worker();
  if (!loaded) {
    const variant = selectedVariant();
    loaded = start(variant, onProgress, signal)
      .catch((error) => {
        if (variant !== 'multi-thread' || signal?.aborted || isCancelled(error)) throw error;
        markMultiThreadBroken();
        releaseEngine();
        worker();
        return start('single-thread', onProgress, signal);
      })
      .catch((error) => {
        loaded = undefined;
        throw error;
      });
  }
  return loaded;
}

const inputName = (file: File, i: number) => `${i}.${(file.name.match(/\.([a-z0-9]{1,6})$/i)?.[1] || 'bin').toLowerCase()}`;

/** Duration, size and streams of a file (reads only the parts FFmpeg needs). */
export async function probe(file: File, onProgress?: OnProgress, signal?: AbortSignal) {
  await loadEngine(onProgress, signal);
  const r = await worker().request<{ info: unknown }>('probe', { name: inputName(file, 0), blob: file }, { signal });
  return mediaInfo(r.info);
}

function serial<T>(work: () => Promise<T>): Promise<T> {
  const run = busy.then(work, work);
  busy = run.catch(() => {});
  return run;
}

/**
 * Runs one tool on its input files and returns the finished files (on disk when
 * the browser supports it). Jobs are serialized: there is one engine.
 */
type RunOptions = { onProgress?: OnProgress; signal?: AbortSignal; infos?: ReturnType<typeof mediaInfo>[] };

export function runTool(toolId: string, files: File[], options: Record<string, unknown>, run: RunOptions = {}): Promise<File[]> {
  return serial(async () => {
    try {
      return await attempt(toolId, files, options, run);
    } catch (error) {
      // The multi-thread engine crashed (not a settings or file problem): run the
      // job again on the single-thread engine, which this tab then keeps using.
      const engineFault = error instanceof WorkerCrashError || (error instanceof Error && error.message === OUT_OF_MEMORY);
      if (running === 'multi-thread' && engineFault && !run.signal?.aborted) {
        markMultiThreadBroken();
        releaseEngine();
        try {
          return await attempt(toolId, files, options, run);
        } catch (retryError) {
          throw explainFault(retryError, files);
        }
      }
      throw explainFault(error, files);
    }
  });
}

/** A WebAssembly crash on a small file is an engine fault, not the device running out of memory. */
function explainFault(error: unknown, files: File[]) {
  const bytes = files.reduce((n, f) => n + f.size, 0);
  if (error instanceof Error && error.message === OUT_OF_MEMORY && bytes < 64 * 1024 * 1024)
    return new MediaError('The media engine stopped unexpectedly with these settings. Try another output format or setting. Your file is unchanged.');
  return error;
}

async function attempt(toolId: string, files: File[], options: Record<string, unknown>, { onProgress, signal, infos }: RunOptions) {
    if (signal?.aborted) throw new CancelledError();
    const recipe = (recipes as Record<string, any>)[toolId];
    if (!recipe) throw new Error(`Unknown tool: ${toolId}`);
    await loadEngine(onProgress, signal);
    const w = worker();
    onProgress?.(0, 'reading');
    const known = infos || [];
    const inputs = [];
    for (let i = 0; i < files.length; i++) {
      const info = known[i] || (await probe(files[i], undefined, signal));
      inputs.push({ name: files[i].name, path: `/in/${inputName(files[i], i)}`, info });
    }
    // Synchronous OPFS handles only exist inside workers, so the worker checks
    // for them itself; here we only need OPFS and this tab's folder.
    const useDisk = device().opfs && Boolean(await tempDir());
    const job = `j${Date.now().toString(36)}${++counter}`;
    const began = await w.request<{ disk: boolean }>('begin', { job, session: useDisk ? sessionName() : undefined, inputs: files.map((f, i) => ({ name: inputName(f, i), blob: f })) }, { signal });
    const backend = {
      exec: (args: string[], outputs: string[], onTime: (t: number) => void) =>
        w.request<{ ret: number; log: string }>('exec', { args, outputs }, { signal, onProgress: (p) => onTime(Number(p.time) || 0) }),
      write: (path: string, data: string | Uint8Array) => w.request('write', { path, data }, { signal }),
      asset: async (path: string) => {
        const response = await fetch(new URL(`/${path}`, location.href));
        if (!response.ok) throw new MediaError('A file the engine needs could not be downloaded. Check your connection and try again.');
        return new Uint8Array(await response.arrayBuffer());
      },
      remove: (names: string[]) => w.request('remove', { names }, { signal }),
      list: async () => (await w.request<{ names: string[] }>('list', {}, { signal })).names,
      collect: async (names: string[], opts: { jpeg?: boolean } = {}) => {
        const r = await w.request<{ files: { name: string; size: number; disk?: string; buffer?: ArrayBuffer }[] }>('collect', { names }, { signal });
        const out: File[] = [];
        for (const f of r.files) {
          const file = f.disk ? await getFile(f.disk, mimeFor(f.name)) : new File([f.buffer!], f.name, { type: mimeFor(f.name) });
          if (!opts.jpeg) {
            out.push(file);
            continue;
          }
          // FFmpeg's MJPEG encoder reads out of bounds in browser WebAssembly, so
          // frames come out as PNG and the browser's own encoder makes the JPG.
          const jpg = await putFile(`${job}__${f.name.replace(/\.png$/i, '.jpg')}`, await pngToJpeg(file));
          out.push(new File([jpg], f.name.replace(/\.png$/i, '.jpg'), { type: 'image/jpeg' }));
          if (f.disk) await removeFile(f.disk);
        }
        return out;
      },
    };
    let failed = false;
    const started = performance.now();
    let produced: File[] = [];
    try {
      const ctx = createContext(backend, { inputs, signal, onProgress: (r: number, phase: Phase) => onProgress?.(r, phase) });
      const outputs: File[] = await recipe(ctx, options);
      if (!outputs.length) throw new MediaError('The engine finished but produced no file. Try other settings.');
      produced = outputs;
      return outputs;
    } catch (error) {
      // A settings problem found before FFmpeg ran leaves the engine healthy.
      failed = !(error instanceof MediaError && !(error as MediaError & { log?: string }).log);
      throw error;
    } finally {
      if (w.alive) await w.request('end', {}).catch(() => {});
      jobs++;
      // Timing for the ?diagnostics panel (no file names or contents).
      dispatchEvent(
        new CustomEvent('kittysuite:job', {
          detail: {
            tool: toolId,
            ms: performance.now() - started,
            inputBytes: files.reduce((n, f) => n + f.size, 0),
            outputBytes: produced.reduce((n, f) => n + f.size, 0),
            ok: produced.length > 0,
            onDisk: Boolean(began?.disk),
            engine: running,
          },
        }),
      );
      if (failed || releaseEnginesAfterJobs() || jobs % RECYCLE_AFTER === 0) releaseEngine();
    }
}

// Leftovers from tabs that closed mid-job are removed shortly after load.
setTimeout(() => void cleanupStale().catch(() => {}), 3000);
