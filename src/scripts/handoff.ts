// Carries files from one tool page to another on this device ("Combine into one
// PDF", "Compress this PDF"). Files go through IndexedDB in this browser only and
// are read once, then deleted. If storage is unavailable the next tool simply
// opens empty and the person chooses the files again.
const DB = 'kittysuite-handoff';
const STORE = 'files';
const KEY = 'pending';
const MAX_AGE = 10 * 60 * 1000;

type Stored = {
  tool: string;
  at: number;
  files: { name: string; type: string; blob: Blob }[];
};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function run<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = work(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** The localized URL of a tool, taken from the links already on the page. */
export function toolHref(id: string) {
  const link = document.querySelector<HTMLAnchorElement>(
    `a[data-tool-id="${id}"]`,
  );
  return link?.getAttribute('href') || `/${id}/`;
}

/** Stores `files` for `tool` and opens that tool. */
export async function handOff(
  tool: string,
  files: (File | { name: string; blob: Blob })[],
) {
  try {
    const db = await open();
    const value: Stored = {
      tool,
      at: Date.now(),
      files: files.map((f) =>
        f instanceof File
          ? { name: f.name, type: f.type, blob: f }
          : { name: f.name, type: f.blob.type, blob: f.blob },
      ),
    };
    await run(db, 'readwrite', (store) => store.put(value, KEY));
    db.close();
  } catch {
    // Private browsing or storage disabled: the next tool opens empty.
  }
  const href = toolHref(tool);
  location.assign(href + (href.includes('?') ? '&' : '?') + 'handoff=1');
}

/** Files handed to this tool, if any (read once). */
export async function takeHandoff(tool: string): Promise<File[]> {
  if (!new URLSearchParams(location.search).has('handoff')) return [];
  history.replaceState(null, '', location.pathname + location.hash);
  try {
    const db = await open();
    const value = (await run(db, 'readonly', (store) => store.get(KEY))) as
      Stored | undefined;
    await run(db, 'readwrite', (store) => store.delete(KEY));
    db.close();
    if (!value || value.tool !== tool || Date.now() - value.at > MAX_AGE)
      return [];
    return value.files.map(
      (f) => new File([f.blob], f.name, { type: f.type || 'application/pdf' }),
    );
  } catch {
    return [];
  }
}
