// Getting results off the page: share sheet on phones (Web Share with files),
// a save dialog where the browser has one, and a plain download everywhere.

export function canShare(files: File[]) {
  try {
    return (
      files.length > 0 &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files })
    );
  } catch {
    return false;
  }
}

/** Opens the system share sheet. Resolves false if the person closes it. */
export async function share(files: File[], title?: string) {
  try {
    await navigator.share({ files, title });
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return false;
    throw new Error('Sharing is not available here. Use Download instead.');
  }
}

/** Plain download through a temporary link (works in every browser). */
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), {
    href: url,
    download: name,
  });
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser time to start reading before the URL is released.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * "Save as…" dialog where available (desktop Chromium); the file is streamed to
 * disk, so large results are not copied in memory. Falls back to a download.
 */
export async function saveAs(blob: Blob, name: string) {
  const picker = (window as any).showSaveFilePicker;
  if (typeof picker !== 'function') return download(blob, name);
  let handle;
  try {
    handle = await picker({ suggestedName: name });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    return download(blob, name);
  }
  const writable = await handle.createWritable();
  await blob.stream().pipeTo(writable);
}

/** File objects for sharing, with a type so share targets accept them. */
export function asFiles(outputs: { name: string; blob: Blob }[]) {
  return outputs.map((o) =>
    o.blob instanceof File && o.blob.name === o.name
      ? o.blob
      : new File([o.blob], o.name, { type: o.blob.type }),
  );
}
