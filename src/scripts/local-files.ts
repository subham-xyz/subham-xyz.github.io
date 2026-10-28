import { isOutOfMemory, OUT_OF_MEMORY } from './device-limits.mjs';
// No file-count or size caps: only empty and unsupported files are refused.
// Real limits (memory, canvas size) surface as errors from the work itself.
export function validateBatch(files: File[], extensions: RegExp) {
  if (!files.length) throw new Error('Choose at least one file.');
  const unusable = files.find(
    (file) => !file.size || !extensions.test(file.name),
  );
  if (unusable)
    throw new Error(
      `Cannot use ${unusable.name}. Choose a supported, non-empty file.`,
    );
}
export function bindDrop(
  input: HTMLInputElement,
  select: (files: File[]) => Promise<void>,
) {
  input.addEventListener('change', () => {
    if (input.files?.length) void select([...input.files]);
  });
  const area = input.closest<HTMLElement>('[data-drop]')!;
  for (const event of ['dragover', 'dragenter'])
    area.addEventListener(event, (e) => {
      e.preventDefault();
      area.classList.add('dragging');
    });
  area.addEventListener('dragleave', () => area.classList.remove('dragging'));
  area.addEventListener('drop', (event) => {
    event.preventDefault();
    area.classList.remove('dragging');
    if (event.dataTransfer?.files.length)
      void select([...event.dataTransfer.files]);
  });
}
export function downloads(container: HTMLElement) {
  let urls: string[] = [];
  const clear = () => {
    urls.forEach((url) => URL.revokeObjectURL(url));
    urls = [];
    container.replaceChildren();
  };
  window.addEventListener('pagehide', clear);
  return {
    clear,
    add(blob: Blob, name: string) {
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      urls.push(url);
      link.href = url;
      link.download = name;
      const label = document.createElement('span');
      label.textContent = name;
      const meta = document.createElement('small');
      meta.textContent =
        blob.size < 1024 * 1024
          ? `${Math.max(1, Math.round(blob.size / 1024))} KB`
          : `${(blob.size / 1048576).toFixed(1)} MB`;
      link.append(label, meta);
      link.setAttribute('aria-label', `Download ${name}`);
      container.append(link);
      return url;
    },
  };
}
// Names are numbered to keep order and avoid clashes, unless the set has fixed
// names that must stay exact (e.g. favicon.ico).
export async function zipOutputs(
  files: { name: string; blob: Blob }[],
  numbered = true,
) {
  const { zip } = await import('fflate');
  const entries: Record<string, Uint8Array> = {};
  for (let i = 0; i < files.length; i++)
    entries[
      `${numbered ? `${i + 1}-` : ''}${files[i].name.replace(/[/\\]/g, '-')}`
    ] = new Uint8Array(await files[i].blob.arrayBuffer());
  const bytes = await new Promise<Uint8Array>((resolve, reject) =>
    zip(entries, { level: 0 }, (error, data) =>
      error ? reject(error) : resolve(data),
    ),
  );
  return new Blob([bytes as BlobPart], { type: 'application/zip' });
}
export function friendlyError(error: unknown) {
  if (isOutOfMemory(error)) return OUT_OF_MEMORY;
  return error instanceof Error && error.message.length < 300
    ? error.message
    : 'This file could not be processed. Check that it opens elsewhere, or try another browser.';
}
// Lets the page paint between steps. Background tabs do not run animation
// frames, so a short timer keeps long jobs going while the tab is hidden.
export const pausePaint = () =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 100);
    requestAnimationFrame(() => {
      clearTimeout(timer);
      resolve();
    });
  });
