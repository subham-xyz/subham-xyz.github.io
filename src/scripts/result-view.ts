import { size } from './image-core.mjs';
import { setKittyState } from './tool-state';

type Output = { name: string; blob: Blob };

// Shared iLoveIMG-style result screen: one big download, measured savings and
// the individual files. Object URLs are owned by the caller's downloads() list.
export function resultView(prefix: string, root: HTMLElement) {
  const get = (id: string) => document.getElementById(`${prefix}-${id}`)!;
  const panel = get('result');
  let zipUrl = '';
  function clearZip() {
    if (zipUrl) URL.revokeObjectURL(zipUrl);
    zipUrl = '';
  }
  function setDownload(
    outputs: Output[],
    urls: string[],
    zip?: Blob,
    zipName?: string,
  ) {
    const link = get('download') as HTMLAnchorElement;
    if (outputs.length > 1 && zip) {
      zipUrl = URL.createObjectURL(zip);
      link.href = zipUrl;
      link.download = zipName || 'files.zip';
      get('download-label').textContent =
        `Download all (${outputs.length} files, ZIP)`;
      return;
    }
    link.href = urls[0];
    link.download = outputs[0].name;
    get('download-label').textContent =
      `Download ${outputs[0].name.split('.').pop()!.toUpperCase()}`;
  }
  // The "% smaller" ring, shown only when the output is smaller than the original.
  function setSavings(outputs: Output[], original?: number) {
    const total = outputs.reduce((n, o) => n + o.blob.size, 0);
    const stats = get('stats');
    stats.hidden = !(original && total < original);
    if (stats.hidden) return;
    const saved = Math.round((1 - total / original!) * 100);
    get('ring').style.setProperty('--p', String(saved));
    get('ring-value').textContent = `${saved}%`;
    const line = document.createElement('span');
    line.textContent = `Your ${outputs.length > 1 ? 'files are' : 'file is'} now ${saved}% smaller!`;
    const sizes = document.createElement('strong');
    sizes.textContent = `${size(original!)} → ${size(total)}`;
    get('stats-text').replaceChildren(line, sizes);
  }
  return {
    show(
      outputs: Output[],
      urls: string[],
      opts: {
        original?: number;
        zip?: Blob;
        zipName?: string;
        summary?: string;
        editor: HTMLElement;
        upload?: HTMLElement;
      },
    ) {
      clearZip();
      setDownload(outputs, urls, opts.zip, opts.zipName);
      setSavings(outputs, opts.original);
      get('summary').textContent = opts.summary || '';
      opts.editor.hidden = true;
      if (opts.upload) opts.upload.hidden = true;
      panel.hidden = false;
      panel.classList.remove('state-enter');
      void panel.offsetWidth;
      panel.classList.add('state-enter');
      setKittyState(root, 'success');
      (get('result-title') as HTMLElement).focus({ preventScroll: true });
      root.scrollIntoView({
        block: 'start',
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
      });
    },
    hide() {
      clearZip();
      panel.hidden = true;
      setKittyState(root, 'idle');
    },
    onBack(fn: () => void) {
      get('back').addEventListener('click', fn);
    },
    onStartOver(fn: () => void) {
      panel.querySelector('[data-start-over]')!.addEventListener('click', fn);
    },
  };
}
