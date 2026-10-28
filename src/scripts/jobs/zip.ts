// Streams many files into one ZIP without holding them all in memory: each
// file is read chunk by chunk and the archive is written to this tab's OPFS
// folder when available (otherwise kept as Blob parts). Entries are stored
// (not recompressed): media and images are already compressed.
import { tempDir } from './temp-store';

type Sink = { write(chunk: Uint8Array): Promise<void>; close(): Promise<File> };

async function openSink(name: string): Promise<Sink> {
  const dir = await tempDir();
  if (dir) {
    try {
      const handle = await dir.getFileHandle(`zip__${Date.now()}__${name}`, { create: true });
      const writable = await (handle as any).createWritable?.();
      if (writable)
        return {
          write: (chunk) => writable.write(chunk),
          async close() {
            await writable.close();
            const file = await handle.getFile();
            return new File([file], name, { type: 'application/zip' });
          },
        };
    } catch {
      // fall back to memory
    }
  }
  const parts: Uint8Array[] = [];
  return {
    async write(chunk) {
      parts.push(chunk);
    },
    async close() {
      return new File(parts as BlobPart[], name, { type: 'application/zip' });
    },
  };
}

function unique(name: string, used: Set<string>) {
  const clean = name.replace(/[/\\]+/g, '-').replace(/^\.+/, '') || 'file';
  let candidate = clean;
  for (let n = 2; used.has(candidate.toLowerCase()); n++)
    candidate = clean.replace(/(\.[^.]+)?$/, (ext) => `-${n}${ext || ''}`);
  used.add(candidate.toLowerCase());
  return candidate;
}

export async function zipFiles(
  files: { name: string; blob: Blob }[],
  name = 'files.zip',
  onProgress?: (done: number, total: number) => void,
) {
  const { Zip, ZipPassThrough } = await import('fflate');
  const sink = await openSink(name);
  let chain = Promise.resolve();
  let failure: unknown;
  const zip = new Zip((error, chunk) => {
    if (error) failure = error;
    else {
      const copy = chunk;
      chain = chain.then(() => sink.write(copy));
    }
  });
  const used = new Set<string>();
  const total = files.reduce((n, f) => n + f.blob.size, 0);
  let done = 0;
  for (const file of files) {
    const entry = new ZipPassThrough(unique(file.name, used));
    zip.add(entry);
    const reader = file.blob.stream().getReader();
    for (;;) {
      const { done: finished, value } = await reader.read();
      if (finished) break;
      entry.push(value);
      done += value.length;
      onProgress?.(done, total);
      await chain; // backpressure: wait for the disk before reading more
    }
    entry.push(new Uint8Array(0), true);
  }
  zip.end();
  await chain;
  if (failure) throw failure;
  return sink.close();
}
