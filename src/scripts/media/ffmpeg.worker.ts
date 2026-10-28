/// <reference lib="webworker" />
// The shared media engine worker: one FFmpeg WebAssembly core (single-thread by
// default; a multi-threaded core can be selected when the page is cross-origin
// isolated and the files are deployed). Inputs are mounted lazily from the
// person's File objects (nothing is copied into memory up front) and announced
// outputs are written straight to this tab's OPFS folder.
// Protocol: see src/scripts/jobs/worker-client.ts.
import { FFmpegHost } from './ffmpeg-host.mjs';

declare const self: DedicatedWorkerGlobalScope;
const CACHE = 'kittysuite-engines-v1';

let host: FFmpegHost | undefined;
let loading: Promise<string> | undefined;
let disk: FileSystemDirectoryHandle | undefined;
let job = '';
// Disk handles created for this job, by output name.
const handles = new Map<string, { file: string; access: any }>();

const post = (data: unknown, transfer: Transferable[] = []) => self.postMessage(data, transfer);

async function fetchCached(url: string, onBytes: (loaded: number, total: number, cached: boolean) => void) {
  let cache: Cache | undefined;
  try {
    cache = await caches.open(CACHE);
  } catch {
    cache = undefined; // storage blocked: download every time
  }
  let response = await cache?.match(url);
  const cached = Boolean(response);
  if (!response) {
    response = await fetch(url);
    if (!response.ok) throw new Error(`The media engine could not be downloaded (HTTP ${response.status}).`);
    try {
      await cache?.put(url, response.clone());
    } catch {
      // quota: keep going without caching
    }
  }
  const total = Number(response.headers.get('content-length')) || 0;
  const reader = response.body!.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onBytes(loaded, total, cached);
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

/** The engine ships gzip-compressed (hosting file-size limits). */
async function gunzip(data: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof DecompressionStream === 'function') {
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  const { gunzipSync } = await import('fflate');
  return gunzipSync(data) as Uint8Array<ArrayBuffer>;
}

async function load(id: number, coreURL: string, wasmURL: string, variant = 'single-thread', threads = 0) {
  const threaded = variant === 'multi-thread';
  if (threaded && threads > 0) {
    // FFmpeg sizes its "auto" thread counts from the CPU count. Capping it keeps
    // every job inside the pre-started thread pool and light enough for phones.
    Object.defineProperty(self.navigator, 'hardwareConcurrency', { configurable: true, get: () => threads });
  }
  // The multi-threaded core starts its threads from ffmpeg-core.worker.js next to it.
  const workerURL = threaded ? coreURL.replace(/ffmpeg-core\.js$/, 'ffmpeg-core.worker.js') : '';
  const download = await fetchCached(wasmURL, (loaded, total, cached) =>
    post({ id, type: 'progress', phase: cached ? 'engine-cached' : 'engine', loaded, total }),
  );
  const bytes = (wasmURL.endsWith('.gz') ? await gunzip(download) : download) as Uint8Array<ArrayBuffer>;
  post({ id, type: 'progress', phase: 'engine-start' });
  const module = await WebAssembly.compile(bytes);
  const { default: create } = await import(/* @vite-ignore */ coreURL);
  // Emscripten never rejects when instantiation fails (for example when a phone
  // cannot reserve the threaded core's 1 GB of shared memory), so failures are
  // raced in here and the page falls back to the single-thread engine.
  let fail: (error: unknown) => void = () => {};
  const failed = new Promise<never>((_, reject) => (fail = reject));
  // The threaded core also waits for its thread workers; if a host blocks them
  // it would wait forever, so give up after 45 s (the download is already done).
  if (threaded) setTimeout(() => fail(new Error('The multi-thread media engine did not start.')), 45_000);
  const core = await Promise.race([
    create({
      mainScriptUrlOrBlob: `${coreURL}#${btoa(JSON.stringify({ wasmURL, workerURL }))}`,
      instantiateWasm(imports: WebAssembly.Imports, done: (i: WebAssembly.Instance, m: WebAssembly.Module) => void) {
        WebAssembly.instantiate(module, imports).then((instance) => done(instance, module), fail);
        return {};
      },
      onAbort: (reason: unknown) => fail(new Error(String(reason || 'The media engine could not start.'))),
    }),
    failed,
  ]);
  host = new FFmpegHost(core, { workerfs: true, threads: threaded ? threads : 0 });
  return variant;
}

async function openDisk(session: string | undefined) {
  disk = undefined;
  if (!session) return;
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('kittysuite-temp', { create: true })).getDirectoryHandle(session, {
      create: true,
    });
    // Probe: synchronous access handles exist in this browser's workers.
    if (typeof (FileSystemFileHandle.prototype as any).createSyncAccessHandle === 'function') disk = dir;
  } catch {
    disk = undefined;
  }
}

async function announce(names: string[]) {
  if (!disk || !host) return;
  for (const name of names) {
    if (handles.has(name)) continue;
    const file = `${job}__${name}`;
    try {
      const fileHandle = await disk.getFileHandle(file, { create: true });
      const access = await (fileHandle as any).createSyncAccessHandle();
      handles.set(name, { file, access });
      host.announce(name, access);
    } catch {
      // quota or locked: this output stays in memory
    }
  }
}

async function closeHandles(remove: boolean) {
  for (const [name, { file, access }] of handles) {
    try {
      access.flush();
      access.close();
    } catch {
      // already closed
    }
    if (remove)
      try {
        await disk?.removeEntry(file);
      } catch {
        // gone
      }
    handles.delete(name);
  }
}

async function collect(names: string[]) {
  const results: { name: string; size: number; disk?: string; buffer?: ArrayBuffer }[] = [];
  const transfer: Transferable[] = [];
  const files = host!.files();
  for (const name of names) {
    const file = files.find((f) => f.name === name);
    if (!file) continue;
    const handle = handles.get(name);
    if (handle) {
      handle.access.flush();
      const size = handle.access.getSize();
      handle.access.close();
      handles.delete(name);
      host!.remove(name);
      results.push({ name, size, disk: handle.file });
      continue;
    }
    // Memory-backed output: move it to disk when possible, else hand it over.
    const data = file.data as Uint8Array;
    if (disk) {
      try {
        const target = `${job}__${name}`;
        const access = await (await disk.getFileHandle(target, { create: true }) as any).createSyncAccessHandle();
        access.truncate(0);
        access.write(data, { at: 0 });
        access.flush();
        access.close();
        host!.remove(name);
        results.push({ name, size: data.length, disk: target });
        continue;
      } catch {
        // fall through to memory
      }
    }
    const copy = data.slice();
    host!.remove(name);
    results.push({ name, size: copy.length, buffer: copy.buffer });
    transfer.push(copy.buffer);
  }
  return { results, transfer };
}

self.onmessage = async ({ data }) => {
  const { id, type } = data;
  try {
    if (type === 'load') {
      loading ||= load(id, data.coreURL, data.wasmURL, data.variant, Number(data.threads) || 0);
      post({ id, type: 'result', variant: await loading });
      return;
    }
    if (!host) throw new Error('The media engine is not loaded.');
    if (host.dead) throw Object.assign(new Error('The media engine stopped and must restart.'), { fatal: true });
    switch (type) {
      case 'begin': {
        await closeHandles(true);
        host.clear();
        job = String(data.job);
        await openDisk(data.session);
        host.mountInputs(data.inputs);
        for (const f of data.files || []) host.write(f.path, f.data);
        post({ id, type: 'result', disk: Boolean(disk) });
        return;
      }
      case 'probe': {
        host.clear();
        host.mountInputs([{ name: data.name, blob: data.blob }]);
        const info = host.probe(`/in/${data.name}`);
        host.clear();
        post({ id, type: 'result', info });
        return;
      }
      case 'write':
        host.write(data.path, data.data);
        post({ id, type: 'result' });
        return;
      case 'exec': {
        await announce(data.outputs || []);
        let last = 0;
        host.onTime = (time: number) => {
          const now = performance.now();
          if (now - last < 200) return;
          last = now;
          post({ id, type: 'progress', time });
        };
        const result = host.exec(data.args);
        host.onTime = null;
        if (result.crashed) {
          post({ id, type: 'error', fatal: true, message: result.log.split('\n').pop() || 'The media engine stopped.' });
          return;
        }
        post({ id, type: 'result', ret: result.ret, log: result.log });
        return;
      }
      case 'collect': {
        const { results, transfer } = await collect(data.names);
        post({ id, type: 'result', files: results }, transfer);
        return;
      }
      case 'remove':
        for (const name of data.names) {
          const handle = handles.get(name);
          if (handle) {
            try {
              handle.access.close();
              await disk?.removeEntry(handle.file);
            } catch {
              // gone
            }
            handles.delete(name);
          }
          host.remove(name);
        }
        post({ id, type: 'result' });
        return;
      case 'list':
        post({ id, type: 'result', names: host.files().map((f) => f.name) });
        return;
      case 'end':
        await closeHandles(true);
        host.clear();
        post({ id, type: 'result' });
        return;
      default:
        throw new Error(`Unknown request: ${type}`);
    }
  } catch (error: any) {
    post({ id, type: 'error', fatal: Boolean(error?.fatal || host?.dead), message: String(error?.message || error) });
  }
};
