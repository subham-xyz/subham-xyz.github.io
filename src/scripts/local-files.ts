export const maxBatchBytes = 80 * 1024 * 1024;
export function validateBatch(
  files: File[],
  extensions: RegExp,
  max = 20 * 1024 * 1024,
) {
  if (!files.length) throw new Error('Choose at least one file.');
  if (
    files.length > 30 ||
    files.reduce((n, f) => n + f.size, 0) > maxBatchBytes
  )
    throw new Error('Choose up to 30 files and 80 MB total.');
  for (const file of files)
    if (!file.size || file.size > max || !extensions.test(file.name))
      throw new Error(
        `Cannot use ${file.name}. Choose a supported, non-empty file under ${Math.round(max / 1048576)} MB.`,
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
      link.textContent = `Download ${name}`;
      container.append(link);
      return url;
    },
  };
}
export async function zipOutputs(files: { name: string; blob: Blob }[]) {
  const { zip } = await import('fflate');
  const entries: Record<string, Uint8Array> = {};
  for (let i = 0; i < files.length; i++)
    entries[`${i + 1}-${files[i].name.replace(/[/\\]/g, '-')}`] =
      new Uint8Array(await files[i].blob.arrayBuffer());
  const bytes = await new Promise<Uint8Array>((resolve, reject) =>
    zip(entries, { level: 0 }, (error, data) =>
      error ? reject(error) : resolve(data),
    ),
  );
  return new Blob([bytes as BlobPart], { type: 'application/zip' });
}
export function friendlyError(error: unknown) {
  return error instanceof Error && error.message.length < 300
    ? error.message
    : 'This file could not be processed. Try a smaller, readable file or another browser.';
}
export const pausePaint = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
