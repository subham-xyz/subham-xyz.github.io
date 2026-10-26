// ODT to PDF: choose a document → preview the converted pages → download.
// Conversion runs in this tab (odt-core.mjs); nothing is uploaded.
import { bindDrop, downloads, friendlyError, pausePaint } from './local-files';
import { encode, size } from './image-core.mjs';
import { resultView } from './result-view';
import { setKittyState } from './tool-state';

type Converted = {
  bytes: Uint8Array;
  pages: number;
  mode: string;
  warnings: string[];
};
type TextStyle = {
  kind: string;
  bold: boolean;
  italic: boolean;
  size: number;
  rel?: number;
  color: string;
};

const root = document.getElementById('odt-tool');
if (root) {
  const get = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const status = (text: string) => (get('odt-status').textContent = text);
  const editor = get('odt-editor');
  const upload = get('odt-upload');
  const output = downloads(get('odt-output'));
  const result = resultView('odt', root);
  const PREVIEW = 12;
  const NOTES: Record<string, string> = {
    image:
      'Some images could not be converted (for example WMF or EMF drawings) and were left out.',
    shape: 'Drawing shapes are not converted.',
    object: 'Embedded objects such as charts are left out.',
    clipped: 'A very tall table row or image was cut to fit the page.',
    'replaced-characters':
      'Some characters could not be written and were replaced with “?”.',
  };
  let file: File | undefined;
  let source: Uint8Array | undefined;
  let converted: Converted | undefined;
  let busy = false;
  let generation = 0;

  // Text that the built-in PDF fonts cannot encode is painted with the browser's
  // own fonts, which cover Hindi, Japanese, Korean and most other scripts.
  // Generic families: the system's own fonts, with its fallbacks for every script.
  const FAMILIES: Record<string, string> = {
    sans: 'sans-serif',
    serif: 'serif',
    mono: 'monospace',
  };
  const cssFont = (st: TextStyle) =>
    `${st.italic ? 'italic ' : ''}${st.bold ? 'bold ' : ''}${st.size * (st.rel || 1)}px ${FAMILIES[st.kind] || FAMILIES.sans}`;
  const measurer = document.createElement('canvas').getContext('2d')!;
  const SCALE = 2;
  const canvas = {
    measure(text: string, st: TextStyle) {
      measurer.font = cssFont(st);
      return measurer.measureText(text).width;
    },
    async paint(ops: any[], page: { width: number; height: number }) {
      const c = document.createElement('canvas');
      c.width = Math.round(page.width * SCALE);
      c.height = Math.round(page.height * SCALE);
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.scale(SCALE, SCALE);
      ctx.textBaseline = 'alphabetic';
      for (const op of ops) {
        if (op.t === 'text') {
          ctx.font = cssFont(op.st);
          ctx.fillStyle = op.st.color;
          ctx.fillText(op.s, op.x, op.y);
        } else if (op.t === 'rect') {
          ctx.fillStyle = op.color;
          ctx.fillRect(op.x, op.y, op.w, op.h);
        } else if (op.t === 'line') {
          ctx.strokeStyle = op.color;
          ctx.lineWidth = op.w;
          ctx.beginPath();
          ctx.moveTo(op.x1, op.y1);
          ctx.lineTo(op.x2, op.y2);
          ctx.stroke();
        }
      }
      const blob = await encode(c, 'image/png', 1);
      c.width = c.height = 0;
      return new Uint8Array(await blob.arrayBuffer());
    },
  };
  // GIF, BMP, WebP and SVG pictures are redrawn as PNG (an <img> never runs SVG scripts).
  async function decodeImage(bytes: Uint8Array, mime: string) {
    const url = URL.createObjectURL(
      new Blob([bytes as BlobPart], { type: mime }),
    );
    const img = new Image();
    try {
      img.src = url;
      await img.decode();
      const scale = Math.min(
        1,
        3000 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1),
      );
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round((img.naturalWidth || 1024) * scale));
      c.height = Math.max(1, Math.round((img.naturalHeight || 768) * scale));
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      const blob = await encode(c, 'image/png', 1);
      c.width = c.height = 0;
      return new Uint8Array(await blob.arrayBuffer());
    } catch {
      return null;
    } finally {
      img.removeAttribute('src');
      URL.revokeObjectURL(url);
    }
  }

  const base = () => (file?.name || 'document').replace(/\.[^.]+$/, '');
  const pageSize = () =>
    root.querySelector<HTMLInputElement>('input[name=odt-size]:checked')
      ?.value || 'document';
  const pdfBlob = (bytes: Uint8Array) =>
    new Blob([bytes as BlobPart], { type: 'application/pdf' });

  function showNotes(r: Converted) {
    const list = get('odt-notes');
    const lines = [
      ...(r.mode === 'image'
        ? [
            'This document uses characters outside the standard PDF fonts, so pages are saved as sharp images. Text in the PDF cannot be selected.',
          ]
        : []),
      ...r.warnings.map((w) => NOTES[w]).filter(Boolean),
    ];
    list.replaceChildren(
      ...lines.map((line) => {
        const li = document.createElement('li');
        li.textContent = line;
        return li;
      }),
    );
    list.hidden = !lines.length;
  }

  async function preview(r: Converted, current: number) {
    const { openPDF, renderPDF } = await import('./pdf-render');
    const doc = await openPDF(r.bytes);
    const cards: HTMLElement[] = [];
    try {
      for (let i = 0; i < Math.min(r.pages, PREVIEW); i++) {
        if (current !== generation) return;
        const c = await renderPDF(doc, i, 360);
        const img = document.createElement('img');
        img.src = c.toDataURL('image/jpeg', 0.75);
        img.alt = `Page ${i + 1}`;
        c.width = c.height = 0;
        const thumb = document.createElement('div');
        thumb.className = 'page-thumb';
        thumb.append(img);
        const name = document.createElement('p');
        name.className = 'page-name';
        name.textContent = `Page ${i + 1}`;
        const card = document.createElement('article');
        card.className = 'page-card';
        card.append(thumb, name);
        cards.push(card);
      }
    } finally {
      await doc.loadingTask.destroy();
    }
    if (current !== generation) return;
    get('odt-pages').replaceChildren(...cards);
    get('odt-caption').textContent =
      r.pages > PREVIEW
        ? `Showing the first ${PREVIEW} of ${r.pages} pages.`
        : 'Preview of the converted pages.';
  }

  async function convert() {
    if (!source) return;
    const current = ++generation;
    busy = true;
    get<HTMLButtonElement>('odt-export').disabled = true;
    setKittyState(root!, 'processing');
    status('Converting your document on this device…');
    try {
      await pausePaint();
      const { convertODT } = await import('./odt-core.mjs');
      const r: Converted = await convertODT(source, {
        pageSize: pageSize(),
        canvas,
        decodeImage,
        title: base(),
        async onPage(done: number, total: number) {
          if (total > 15 && done % 5 === 0) {
            status(`Converting page ${done} of ${total}…`);
            await pausePaint();
          }
        },
      });
      if (current !== generation) return;
      converted = r;
      await preview(r, current);
      if (current !== generation) return;
      showNotes(r);
      upload.hidden = true;
      editor.hidden = false;
      setKittyState(root!, 'idle');
      status(
        r.pages === 1
          ? '1 page ready. Review settings, then continue.'
          : `${r.pages} pages ready. Review settings, then continue.`,
      );
    } catch (error) {
      if (current !== generation) return;
      converted = undefined;
      setKittyState(root!, 'error');
      status(friendlyError(error));
      if (editor.hidden) upload.hidden = false;
    } finally {
      if (current === generation) {
        busy = false;
        get<HTMLButtonElement>('odt-export').disabled = !converted;
      }
    }
  }

  async function select(files: File[]) {
    if (busy) return;
    const chosen = files[0];
    if (!chosen) return;
    if (files.length > 1) {
      status('Choose one ODT document at a time.');
      return;
    }
    if (!/\.(odt|ott|fodt)$/i.test(chosen.name)) {
      setKittyState(root!, 'error');
      status(
        /\.docx?$/i.test(chosen.name)
          ? 'This is a Word file. Save it as .odt in Word or LibreOffice, then convert it here.'
          : 'Choose an .odt, .ott or .fodt file.',
      );
      return;
    }
    if (!chosen.size || chosen.size > 30 * 1024 * 1024) {
      setKittyState(root!, 'error');
      status('Choose an ODT file under 30 MB.');
      return;
    }
    file = chosen;
    output.clear();
    result.hide();
    status('Reading your document on this device…');
    source = new Uint8Array(await chosen.arrayBuffer());
    get('odt-file-name').textContent = `${chosen.name} · ${size(chosen.size)}`;
    await convert();
  }

  function reset() {
    generation++;
    busy = false;
    file = source = converted = undefined;
    output.clear();
    result.hide();
    get('odt-pages').replaceChildren();
    get('odt-notes').hidden = true;
    editor.hidden = true;
    upload.hidden = false;
    get<HTMLInputElement>('odt-file').value = '';
    setKittyState(root!, 'idle');
    status('100% on your device');
  }

  bindDrop(get<HTMLInputElement>('odt-file'), select);
  root
    .querySelectorAll<HTMLInputElement>('input[name=odt-size]')
    .forEach((radio) => radio.addEventListener('change', () => void convert()));
  get('odt-reset').addEventListener('click', reset);
  get('odt-export').addEventListener('click', () => {
    if (!converted || busy) return;
    output.clear();
    const name = `${base()}.pdf`;
    const blob = pdfBlob(converted.bytes);
    const url = output.add(blob, name);
    const outputs = [{ name, blob }];
    status('Your PDF is ready!');
    result.show(outputs, [url], {
      summary: size(blob.size),
      editor,
      upload,
    });
  });
  result.onBack(() => {
    result.hide();
    editor.hidden = false;
  });
  result.onStartOver(reset);
}
