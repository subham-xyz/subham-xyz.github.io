// Temporary files on the device's disk (Origin Private File System), so large
// intermediate and output files do not have to sit in memory. Each page session
// owns one folder, held with a Web Lock; folders whose lock is gone (closed or
// crashed tabs) are removed on the next visit. Without OPFS, files stay as Blobs.

const ROOT = 'kittysuite-temp';
const sessionId = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
let sessionDir: Promise<FileSystemDirectoryHandle | undefined> | undefined;

async function rootDir() {
  if (!navigator.storage?.getDirectory) return undefined;
  try {
    const opfs = await navigator.storage.getDirectory();
    return await opfs.getDirectoryHandle(ROOT, { create: true });
  } catch {
    return undefined; // private mode, blocked storage
  }
}

/** This tab's temporary folder (created on first use), or undefined without OPFS. */
export function tempDir() {
  sessionDir ||= (async () => {
    const root = await rootDir();
    if (!root) return undefined;
    const dir = await root.getDirectoryHandle(sessionId, { create: true });
    // Hold a lock for the life of the tab so other tabs know the folder is in use.
    navigator.locks
      ?.request(`${ROOT}-${sessionId}`, () => new Promise<void>(() => {}))
      .catch(() => {});
    addEventListener('pagehide', () => void clearSession());
    return dir;
  })().catch(() => undefined);
  return sessionDir;
}

export const sessionName = () => sessionId;

/** Removes folders left behind by tabs that closed or crashed. */
export async function cleanupStale() {
  const root = await rootDir();
  if (!root) return;
  const held = new Set<string>();
  try {
    const state = await navigator.locks?.query();
    for (const lock of [...(state?.held || []), ...(state?.pending || [])])
      if (lock.name?.startsWith(`${ROOT}-`)) held.add(lock.name.slice(ROOT.length + 1));
  } catch {
    return; // without Web Locks we cannot tell which folders are in use
  }
  for await (const [name] of (root as any).entries() as AsyncIterable<[string, FileSystemHandle]>) {
    if (name === sessionId || held.has(name)) continue;
    try {
      await root.removeEntry(name, { recursive: true });
    } catch {
      // still open in another tab
    }
  }
}

/** Writes a Blob (streamed, chunk by chunk) to disk and returns a disk-backed File. */
export async function putFile(name: string, blob: Blob): Promise<File> {
  const dir = await tempDir();
  if (!dir) return new File([blob], name, { type: blob.type });
  try {
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await (handle as any).createWritable?.();
    if (!writable) return new File([blob], name, { type: blob.type });
    await blob.stream().pipeTo(writable);
    const file = await handle.getFile();
    return new File([file], name, { type: blob.type || file.type });
  } catch {
    return new File([blob], name, { type: blob.type });
  }
}

/** A disk-backed File written by a worker into this session's folder. */
export async function getFile(name: string, type = '') {
  const dir = await tempDir();
  if (!dir) throw new Error('Temporary storage is not available.');
  const file = await (await dir.getFileHandle(name)).getFile();
  return new File([file], name.replace(/^[^_]*__/, ''), { type: type || file.type });
}

export async function removeFile(name: string) {
  const dir = await tempDir();
  try {
    await dir?.removeEntry(name);
  } catch {
    // already gone
  }
}

/** Deletes every temporary file of this tab. */
export async function clearSession() {
  const root = await rootDir();
  try {
    await root?.removeEntry(sessionId, { recursive: true });
  } catch {
    // files still open (a download in progress); removed on the next visit
  }
  sessionDir = undefined;
}

/** Deletes all KittySuite temporary files of every closed tab. */
export async function clearAll() {
  await cleanupStale();
  await clearSession();
}

/** Bytes used by this site's storage, when the browser reports it. */
export async function usage() {
  try {
    const estimate = await navigator.storage?.estimate();
    return { used: estimate?.usage || 0, quota: estimate?.quota || 0 };
  } catch {
    return { used: 0, quota: 0 };
  }
}
