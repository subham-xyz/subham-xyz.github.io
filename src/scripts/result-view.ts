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
  return {
    show(
      outputs: Output[],
      urls: string[],
      opts: { original?: number; zip?: Blob; zipName?: string; summary?: string; editor: HTMLElement; upload?: HTMLElement },
    ) {
      clearZip();
      const link = get('download') as HTMLAnchorElement;
      if (outputs.length > 1 && opts.zip) {
        zipUrl = URL.createObjectURL(opts.zip);
        link.href = zipUrl;
        link.download = opts.zipName || 'kittysuite-files.zip';
        get('download-label').textContent = `Download all (${outputs.length} files, ZIP)`;
      } else {
        link.href = urls[0];
        link.download = outputs[0].name;
        get('download-label').textContent = `Download ${outputs[0].name.split('.').pop()!.toUpperCase()}`;
      }
      const total = outputs.reduce((n, o) => n + o.blob.size, 0);
      const stats = get('stats');
      if (opts.original && total < opts.original) {
        const saved = Math.round((1 - total / opts.original) * 100);
        get('ring').style.setProperty('--p', String(saved));
        get('ring-value').textContent = `${saved}%`;
        get('stats-text').innerHTML = '';
        const line = document.createElement('span');
        line.textContent = `Your ${outputs.length > 1 ? 'files are' : 'file is'} now ${saved}% smaller!`;
        const sizes = document.createElement('strong');
        sizes.textContent = `${size(opts.original)} → ${size(total)}`;
        get('stats-text').append(line, sizes);
        stats.hidden = false;
      } else stats.hidden = true;
      get('summary').textContent = opts.summary || '';
      opts.editor.hidden = true;
      if (opts.upload) opts.upload.hidden = true;
      panel.hidden = false;
      panel.classList.remove('state-enter');
      void panel.offsetWidth;
      panel.classList.add('state-enter');
      setKittyState(root, 'success');
      (get('result-title') as HTMLElement).focus({ preventScroll: true });
      root.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
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
