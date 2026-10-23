import {
  bindDrop,
  downloads,
  validateBatch,
  zipOutputs,
  friendlyError,
  pausePaint,
} from './local-files';
import { encode, size } from './image-core.mjs';
import { decodeImage, editImage } from './image-edit-core.mjs';
if (document.getElementById('pdf-tool')) {
  const root = document.getElementById('pdf-tool')!,
    mode = root.dataset.mode!,
    isImages = ['jpg-to-pdf', 'scan-to-pdf'].includes(mode);
  const get = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const val = (id: string, fallback = '') =>
    get<HTMLInputElement>(id)?.value ?? fallback;
  const num = (id: string, fallback = 0) => Number(val(id, String(fallback)));
  const status = (text: string) => (get('pdf-status').textContent = text);
  const output = downloads(get('pdf-output'));
  type Page = {
    source: number;
    index: number;
    rotation: number;
    selected: boolean;
    thumb: string;
    name: string;
    crop?: { x: number; y: number; w: number; h: number };
  };
  let sources: Uint8Array[] = [],
    docs: any[] = [],
    images: HTMLImageElement[] = [],
    pages: Page[] = [],
    files: File[] = [],
    active = 0,
    busy = false,
    generation = 0;
  let api: typeof import('./pdf-core.mjs'),
    renderer: typeof import('./pdf-render');
  let overlay: File | undefined;
  let overlayPreview: HTMLImageElement | undefined;
  let shapes: any[] = [],
    redactions: Record<number, any[]> = {},
    stroke: any[] | undefined,
    signature = false,
    stream: MediaStream | undefined,
    comparison = '';
  const canvas = get<HTMLCanvasElement>('pdf-preview');
  let baseCanvas: HTMLCanvasElement | undefined;
  const urls: string[] = [];
  async function libs() {
    api ||= await import('./pdf-core.mjs');
    if (!isImages) renderer ||= await import('./pdf-render');
  }
  function rectangle() {
    const r = {
      x: num('pdf-rect-x') / 100,
      y: num('pdf-rect-y') / 100,
      w: num('pdf-rect-w', 50) / 100,
      h: num('pdf-rect-h', 50) / 100,
    };
    if (
      !Object.values(r).every(Number.isFinite) ||
      r.x < 0 ||
      r.y < 0 ||
      r.w <= 0 ||
      r.h <= 0 ||
      r.x + r.w > 1.00001 ||
      r.y + r.h > 1.00001
    )
      throw new Error('Keep the rectangle inside the page.');
    return r;
  }
  function paint() {
    if (!baseCanvas) return;
    canvas.width = baseCanvas.width;
    canvas.height = baseCanvas.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(baseCanvas, 0, 0);
    for (const r of redactions[active] || []) {
      ctx.fillStyle = '#000';
      ctx.fillRect(
        r.x * canvas.width,
        r.y * canvas.height,
        r.w * canvas.width,
        r.h * canvas.height,
      );
    }
    for (const shape of shapes) {
      ctx.strokeStyle = '#16797e';
      ctx.lineWidth = 2;
      if (shape.kind === 'rect')
        ctx.strokeRect(
          shape.x * canvas.width,
          shape.y * canvas.height,
          shape.w * canvas.width,
          shape.h * canvas.height,
        );
      else {
        ctx.beginPath();
        shape.points.forEach((p: any, i: number) =>
          i
            ? ctx.lineTo(p.x * canvas.width, p.y * canvas.height)
            : ctx.moveTo(p.x * canvas.width, p.y * canvas.height),
        );
        ctx.stroke();
      }
    }
    if (['crop-pdf', 'redact-pdf'].includes(mode))
      try {
        const r = rectangle();
        ctx.strokeStyle = '#00a5a5';
        ctx.lineWidth = 3;
        ctx.strokeRect(
          r.x * canvas.width,
          r.y * canvas.height,
          r.w * canvas.width,
          r.h * canvas.height,
        );
      } catch {}
    if (
      ['watermark-pdf', 'edit-pdf', 'sign-pdf', 'page-numbers'].includes(mode)
    ) {
      ctx.globalAlpha = num('pdf-opacity', 100) / 100;
      ctx.fillStyle = '#000';
      ctx.font = `${num('pdf-font-size', 18)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(
        val('pdf-text') ||
          (mode === 'page-numbers'
            ? val('number-format')
                .replace('{n}', String(num('number-start', 1) + active))
                .replace('{total}', String(pages.length))
            : ''),
        (num('pdf-x', 50) / 100) * canvas.width,
        (num('pdf-y', 50) / 100) * canvas.height,
      );
      const mark = mode === 'sign-pdf' && signature ? pad : overlayPreview;
      if (mark) {
        const ratio =
          mark instanceof HTMLImageElement
            ? mark.naturalHeight / mark.naturalWidth
            : mark.height / mark.width;
        const w = (canvas.width * num('pdf-scale', 30)) / 100,
          h = w * ratio;
        ctx.drawImage(
          mark,
          (num('pdf-x', 50) / 100) * canvas.width - w / 2,
          (num('pdf-y', 50) / 100) * canvas.height - h / 2,
          w,
          h,
        );
      }
      ctx.globalAlpha = 1;
    }
  }
  async function preview(index: number) {
    active = index;
    const page = pages[index];
    if (!page) return;
    const current = generation;
    let next: HTMLCanvasElement;
    if (isImages) {
      const image = images[page.source];
      next = editImage(image, {
        mode: 'rotate-image',
        angle: page.rotation,
        mime: 'image/png',
      });
    } else next = await renderer.renderPDF(docs[page.source], page.index, 900);
    if (current !== generation) {
      next.width = next.height = 0;
      return;
    }
    if (baseCanvas) baseCanvas.width = baseCanvas.height = 0;
    baseCanvas = next;
    paint();
    get('preview-caption').textContent =
      `Preview: ${page.name}, page ${page.index + 1}. Export applies the selected options.`;
  }
  function pageList() {
    get('pdf-pages').replaceChildren(
      ...pages.map((page, i) => {
        const card = document.createElement('article');
        card.className = 'local-page';
        card.draggable = [
          'merge-pdf',
          'organize-pdf',
          'jpg-to-pdf',
          'scan-to-pdf',
        ].includes(mode);
        card.ondragstart = (event) =>
          event.dataTransfer?.setData('text/plain', String(i));
        card.ondragover = (event) => event.preventDefault();
        card.ondrop = (event) => {
          event.preventDefault();
          const from = Number(event.dataTransfer?.getData('text/plain'));
          if (Number.isInteger(from) && from >= 0 && from < pages.length) {
            const [item] = pages.splice(from, 1);
            pages.splice(i, 0, item);
            pageList();
            void preview(i);
          }
        };
        const label = document.createElement('label'),
          check = document.createElement('input');
        check.type = 'checkbox';
        check.checked = page.selected;
        check.onchange = () => {
          page.selected = check.checked;
        };
        label.append(
          check,
          document.createTextNode(
            ` ${i + 1}. ${page.name} ? page ${page.index + 1}`,
          ),
        );
        const img = document.createElement('img');
        img.src = page.thumb;
        img.alt = `Page ${i + 1} thumbnail`;
        img.loading = 'lazy';
        card.append(label, img);
        const action = (text: string, fn: () => void, disabled = false) => {
          const b = document.createElement('button');
          b.textContent = text;
          b.className = 'text-link';
          b.disabled = disabled;
          b.onclick = fn;
          card.append(b);
        };
        action('Preview', () => void preview(i));
        if (
          ['merge-pdf', 'organize-pdf', 'jpg-to-pdf', 'scan-to-pdf'].includes(
            mode,
          )
        ) {
          for (const [text, delta] of [
            ['Earlier', -1],
            ['Later', 1],
          ] as const)
            action(
              text,
              () => {
                [pages[i], pages[i + delta]] = [pages[i + delta], pages[i]];
                pageList();
              },
              i + delta < 0 || i + delta >= pages.length,
            );
          action('Rotate 90 degrees', () => {
            page.rotation = (page.rotation + 90) % 360;
            status(
              `Page ${i + 1}: ${page.rotation} degrees clockwise on export.`,
            );
            if (isImages) void preview(i);
          });
          action('Delete', () => {
            pages.splice(i, 1);
            pageList();
            void preview(Math.max(0, i - 1));
          });
        }
        return card;
      }),
    );
  }
  async function select(selected: File[]) {
    if (busy) return;
    busy = true;
    const current = ++generation;
    try {
      validateBatch(
        ['organize-pdf', 'scan-to-pdf'].includes(mode)
          ? [...files, ...selected]
          : selected,
        isImages ? /\.(jpe?g|png|webp)$/i : /\.pdf$/i,
        isImages ? 20 * 1048576 : 40 * 1048576,
      );
      if (
        !isImages &&
        !['merge-pdf', 'organize-pdf', 'compare-pdf'].includes(mode) &&
        selected.length !== 1
      )
        throw new Error('Choose one PDF for this tool.');
      if (mode === 'compare-pdf' && selected.length !== 2)
        throw new Error('Choose exactly two PDFs to compare.');
      status('Loading local PDF tools and reading files...');
      await libs();
      output.clear();
      // Organize and scan allow adding further files/pages; all other tools replace their input.
      if (!['organize-pdf', 'scan-to-pdf'].includes(mode)) await release(false);
      for (const file of selected) {
        const source = files.length;
        files.push(file);
        if (isImages) {
          const image = await decodeImage(file);
          images.push(image);
          if (
            images.reduce(
              (n, img) => n + img.naturalWidth * img.naturalHeight,
              0,
            ) > 40000000
          )
            throw new Error(
              'Use a smaller batch: decoded images are limited to 40 megapixels total.',
            );
          sources.push(new Uint8Array());
          const c = editImage(image, { mode: 'preview', mime: 'image/png' });
          const thumb = c.toDataURL('image/jpeg', 0.45);
          c.width = c.height = 0;
          pages.push({
            source,
            index: 0,
            rotation: 0,
            selected: true,
            thumb,
            name: file.name,
          });
        } else {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const doc = await renderer.openPDF(bytes, val('pdf-password'));
          if (pages.length + doc.numPages > 150) {
            await doc.loadingTask.destroy();
            throw new Error('Choose a total of 150 PDF pages or fewer.');
          }
          sources.push(bytes);
          docs.push(doc);
          for (let i = 0; i < doc.numPages; i++) {
            status(`Reading ${file.name}: page ${i + 1} of ${doc.numPages}...`);
            const c = await renderer.renderPDF(doc, i, 200),
              blob = await encode(c, 'image/jpeg', 0.6);
            c.width = c.height = 0;
            const thumb = URL.createObjectURL(blob);
            urls.push(thumb);
            pages.push({
              source,
              index: i,
              rotation: 0,
              selected: mode !== 'remove-pages',
              thumb,
              name: file.name,
            });
            await pausePaint();
          }
        }
      }
      if (current !== generation) return;
      get('pdf-editor').hidden = false;
      pageList();
      await preview(0);
      if (mode === 'pdf-forms') {
        const fields = await api.readFields(sources[0]);
        get('pdf-fields').replaceChildren(
          ...fields.map((field: any) => {
            const label = document.createElement('label');
            label.textContent =
              field.name +
              (field.type === 'unsupported' ? ' (unsupported field)' : '');
            let control: HTMLInputElement | HTMLSelectElement;
            if (field.type === 'select' || field.type === 'radio') {
              control = document.createElement('select');
              for (const option of field.options) {
                const o = document.createElement('option');
                o.value = o.textContent = option;
                control.append(o);
              }
              control.value = field.value;
            } else {
              control = document.createElement('input');
              control.type = field.type === 'checkbox' ? 'checkbox' : 'text';
              control.value = String(field.value);
              if (control.type === 'checkbox') control.checked = !!field.value;
            }
            control.dataset.fieldName = field.name;
            control.disabled = field.type === 'unsupported';
            label.append(control);
            return label;
          }),
        );
        if (!fields.length)
          status(
            'No existing form fields detected. Use Edit PDF to add a visual annotation.',
          );
        else
          status(
            `${fields.length} existing fields found. Fill supported fields below.`,
          );
      } else
        status(`${pages.length} page(s) ready. Review settings, then export.`);
    } catch (e) {
      await release(false);
      get('pdf-editor').hidden = true;
      status(friendlyError(e));
    } finally {
      busy = false;
    }
  }
  bindDrop(get<HTMLInputElement>('pdf-files'), select);
  for (const [id, value] of [
    ['select-pages', true],
    ['clear-pages', false],
  ] as const)
    get(id).onclick = () => {
      pages.forEach((p) => (p.selected = value));
      pageList();
    };
  root.querySelectorAll('input:not([type=file]),select').forEach((el) =>
    el.addEventListener('input', () => {
      output.clear();
      paint();
    }),
  );
  get('pdf-overlay')?.addEventListener('change', async () => {
    try {
      overlay = get<HTMLInputElement>('pdf-overlay').files?.[0];
      if (overlay) {
        validateBatch([overlay], /\.(png|jpe?g)$/i);
        overlayPreview = await decodeImage(overlay);
        paint();
      }
    } catch (error) {
      overlay = undefined;
      overlayPreview = undefined;
      status(friendlyError(error));
    }
  });
  get('add-redaction')?.addEventListener('click', () => {
    try {
      (redactions[active] ||= []).push(rectangle());
      paint();
      status(
        'Region marked for removal on this page. Review before exporting.',
      );
    } catch (e) {
      status(friendlyError(e));
    }
  });
  get('clear-redactions')?.addEventListener('click', () => {
    redactions = {};
    paint();
  });
  get('add-shape')?.addEventListener('click', () => {
    try {
      shapes.push({ kind: 'rect', ...rectangle() });
      paint();
    } catch (e) {
      status(friendlyError(e));
    }
  });
  get('clear-shapes')?.addEventListener('click', () => {
    shapes = [];
    paint();
  });
  let anchor: { x: number; y: number } | undefined;
  function point(event: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (event.clientY - r.top) / r.height)),
    };
  }
  canvas.onpointerdown = (event) => {
    if (!['crop-pdf', 'redact-pdf', 'edit-pdf'].includes(mode)) return;
    anchor = point(event);
    canvas.setPointerCapture(event.pointerId);
    if (mode === 'edit-pdf' && val('annotation-mode') === 'pen') {
      stroke = [anchor];
      shapes.push({ kind: 'pen', points: stroke });
    }
  };
  canvas.onpointermove = (event) => {
    if (!anchor) return;
    const end = point(event);
    if (stroke) stroke.push(end);
    else
      for (const [key, value] of Object.entries({
        x: Math.min(anchor.x, end.x),
        y: Math.min(anchor.y, end.y),
        w: Math.abs(anchor.x - end.x),
        h: Math.abs(anchor.y - end.y),
      }))
        get<HTMLInputElement>('pdf-rect-' + key).value = (value * 100).toFixed(
          2,
        );
    paint();
  };
  canvas.onpointerup = () => {
    if (anchor && mode === 'edit-pdf' && !stroke)
      try {
        shapes.push({ kind: 'rect', ...rectangle() });
      } catch {}
    anchor = undefined;
    stroke = undefined;
    paint();
  };
  canvas.onpointercancel = () => {
    anchor = undefined;
    stroke = undefined;
  };
  const pad = get<HTMLCanvasElement>('signature-pad');
  let drawing = false;
  if (pad) {
    const p = (e: PointerEvent) => {
      const r = pad.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * pad.width,
        y: ((e.clientY - r.top) / r.height) * pad.height,
      };
    };
    pad.onpointerdown = (e) => {
      drawing = true;
      signature = true;
      pad.setPointerCapture(e.pointerId);
      const ctx = pad.getContext('2d')!,
        a = p(e);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
    };
    pad.onpointermove = (e) => {
      if (drawing) {
        const ctx = pad.getContext('2d')!,
          a = p(e);
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineTo(a.x, a.y);
        ctx.stroke();
      }
    };
    pad.onpointerup = pad.onpointercancel = () => {
      drawing = false;
      paint();
    };
    get('signature-clear').onclick = () => {
      pad.getContext('2d')!.clearRect(0, 0, pad.width, pad.height);
      signature = false;
    };
  }
  async function rasterPDF(lossless = false) {
    const frames = [];
    for (let i = 0; i < pages.length; i++) {
      const item = pages[i];
      status(`Rebuilding page ${i + 1} of ${pages.length}...`);
      const c = await renderer.renderPDF(
        docs[item.source],
        item.index,
        mode === 'compress-pdf' ? num('pdf-resolution', 1400) : 1800,
      );
      const ctx = c.getContext('2d')!;
      for (const r of redactions[i] || []) {
        ctx.fillStyle = '#000';
        ctx.fillRect(
          Math.floor(r.x * c.width),
          Math.floor(r.y * c.height),
          Math.ceil(r.w * c.width) + 1,
          Math.ceil(r.h * c.height) + 1,
        );
      }
      const mime = lossless ? 'image/png' : 'image/jpeg';
      const blob = await encode(c, mime, num('pdf-quality', 85) / 100);
      const originalPage = await docs[item.source].getPage(item.index + 1),
        view = originalPage.getViewport({ scale: 1 });
      frames.push({
        bytes: new Uint8Array(await blob.arrayBuffer()),
        mime,
        width: view.width,
        height: view.height,
      });
      c.width = c.height = 0;
      await pausePaint();
    }
    return api.imagesPDF(frames, { pageSize: 'image', margin: 0 });
  }
  async function compare() {
    if (docs.length !== 2) throw new Error('Choose two PDFs first.');
    const index = num('compare-page', 1) - 1;
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      docs.some((d) => index >= d.numPages)
    )
      throw new Error('Choose a page number present in both documents.');
    const canvases = await Promise.all(
      docs.map((d) => renderer.renderPDF(d, index, 900)),
    );
    const text = await Promise.all(
      docs.map((d) => renderer.pageText(d, index)),
    );
    const a = canvases[0],
      b = canvases[1],
      diff = document.createElement('canvas');
    diff.width = Math.max(a.width, b.width);
    diff.height = Math.max(a.height, b.height);
    const ctx = diff.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, diff.width, diff.height);
    ctx.drawImage(a, 0, 0);
    const pixels = ctx.getImageData(0, 0, diff.width, diff.height);
    ctx.fillRect(0, 0, diff.width, diff.height);
    ctx.drawImage(b, 0, 0);
    const other = ctx.getImageData(0, 0, diff.width, diff.height);
    let changed = 0;
    for (let i = 0; i < pixels.data.length; i += 4) {
      const d =
        Math.abs(pixels.data[i] - other.data[i]) +
        Math.abs(pixels.data[i + 1] - other.data[i + 1]) +
        Math.abs(pixels.data[i + 2] - other.data[i + 2]);
      if (d > 45) {
        pixels.data[i] = 220;
        pixels.data[i + 1] = 35;
        pixels.data[i + 2] = 65;
        changed++;
      }
    }
    ctx.putImageData(pixels, 0, 0);
    get('compare-view').replaceChildren(
      ...[a, b, diff].map((c, i) => {
        const img = document.createElement('img');
        img.src = c.toDataURL('image/png');
        img.alt = [
          'First PDF page',
          'Second PDF page',
          'Visual differences highlighted in red',
        ][i];
        c.width = c.height = 0;
        return img;
      }),
    );
    comparison = `Page ${index + 1}: ${changed} changed rendered pixels.\nText ${text[0] === text[1] ? 'matches' : 'differs'}.\n\nFIRST PDF\n${text[0] || '[No selectable text]'}\n\nSECOND PDF\n${text[1] || '[No selectable text]'}`;
    get('compare-text').textContent = comparison;
    status(
      'Comparison ready. Rendering differences may include antialiasing and layout shifts.',
    );
  }
  get('compare-run')?.addEventListener('click', () => {
    void compare().catch((e) => status(friendlyError(e)));
  });
  get('pdf-export').addEventListener('click', async () => {
    if (busy || !pages.length) return;
    busy = true;
    get<HTMLButtonElement>('pdf-export').disabled = true;
    get<HTMLButtonElement>('pdf-reset').disabled = true;
    output.clear();
    try {
      await libs();
      status('Processing on your device...');
      await pausePaint();
      let bytes: Uint8Array | undefined;
      const results: { name: string; blob: Blob }[] = [];
      const selected = pages.filter((p) => p.selected);
      if (isImages) {
        const frames = [];
        for (const item of selected) {
          let image = images[item.source];
          let cropped: HTMLCanvasElement | undefined;
          if (item.crop) {
            cropped = editImage(image, {
              mode: 'crop-image',
              rect: item.crop,
              mime: 'image/png',
            });
            const blob = await encode(cropped, 'image/png', 1);
            image = await decodeImage(new File([blob], 'crop.png'));
          }
          const c = editImage(image, {
            mode: 'rotate-image',
            angle: item.rotation,
            mime: 'image/jpeg',
            background: '#fff',
          });
          frames.push({
            mime: 'image/jpeg',
            bytes: new Uint8Array(
              await (await encode(c, 'image/jpeg', 0.92)).arrayBuffer(),
            ),
          });
          c.width = c.height = 0;
          if (cropped) cropped.width = cropped.height = 0;
        }
        bytes = await api.imagesPDF(frames, {
          pageSize: val('pdf-page-size'),
          orientation: val('pdf-orientation'),
          margin: num('pdf-margin'),
          fit: val('pdf-fit'),
        });
      } else if (mode === 'compare-pdf') {
        await compare();
        results.push({
          name: 'comparison.txt',
          blob: new Blob([comparison], { type: 'text/plain' }),
        });
      } else if (mode === 'redact-pdf') {
        if (!Object.values(redactions).some((r) => r.length))
          throw new Error(
            'Mark at least one region to remove before exporting.',
          );
        bytes = await rasterPDF(true);
      } else if (mode === 'unlock-pdf') bytes = await rasterPDF(true);
      else if (mode === 'compress-pdf' || mode === 'repair-pdf') {
        bytes =
          mode === 'compress-pdf' && val('compression-mode') === 'raster'
            ? await rasterPDF()
            : await api.rewritePDF(sources[0]);
      } else if (mode === 'pdf-forms') {
        const values: Record<string, string | boolean> = {};
        get('pdf-fields')
          .querySelectorAll<HTMLInputElement | HTMLSelectElement>(
            '[data-field-name]',
          )
          .forEach((input) => {
            if (!input.disabled)
              values[input.dataset.fieldName!] =
                input instanceof HTMLInputElement && input.type === 'checkbox'
                  ? input.checked
                  : input.value;
          });
        bytes = await api.fillPDF(sources[0], values);
      } else if (mode === 'pdf-to-jpg' || mode === 'pdf-to-text') {
        const indexes = api.parsePages(val('pdf-range'), pages.length);
        let text = '';
        for (const index of indexes) {
          const page = pages[index];
          status(`Exporting page ${index + 1}...`);
          if (mode === 'pdf-to-jpg') {
            const c = await renderer.renderPDF(
              docs[page.source],
              page.index,
              1800,
            );
            results.push({
              name: `page-${index + 1}.jpg`,
              blob: await encode(c, 'image/jpeg', 0.9),
            });
            c.width = c.height = 0;
          } else {
            text +=
              (val('text-format') === 'md'
                ? `## Page ${index + 1}\n\n`
                : `Page ${index + 1}\n`) +
              ((await renderer.pageText(docs[page.source], page.index)) ||
                '[No selectable text: this may be a scan.]') +
              '\n\n';
          }
        }
        if (mode === 'pdf-to-text')
          results.push({
            name: 'extracted.' + val('text-format'),
            blob: new Blob([text], { type: 'text/plain' }),
          });
      } else if (mode === 'split-pdf') {
        const groups =
          val('split-mode') === 'every'
            ? pages.map((p) => [p])
            : val('split-mode') === 'ranges'
              ? val('split-ranges')
                  .split(';')
                  .map((range) =>
                    api.parsePages(range, pages.length).map((i) => pages[i]),
                  )
              : [
                  val('pdf-range')
                    ? api
                        .parsePages(val('pdf-range'), pages.length)
                        .map((i) => pages[i])
                    : selected,
                ];
        for (let i = 0; i < groups.length; i++)
          results.push({
            name: `part-${i + 1}.pdf`,
            blob: new Blob(
              [(await api.assemblePDF(sources, groups[i])) as BlobPart],
              { type: 'application/pdf' },
            ),
          });
      } else {
        const keep =
          mode === 'remove-pages'
            ? pages.filter((p) => !p.selected)
            : ['extract-pages', 'organize-pdf'].includes(mode)
              ? selected
              : pages;
        const opts: any = {
          mode,
          range: val('pdf-range'),
          angle: num('pdf-angle', 90),
          text: val('pdf-text'),
          numberFormat: val('number-format'),
          start: num('number-start', 1),
          x: num('pdf-x', 50) / 100,
          y: num('pdf-y', 50) / 100,
          fontSize: num('pdf-font-size', 18),
          opacity: num('pdf-opacity', 100) / 100,
          scale: num('pdf-scale', 30) / 100,
          shapes,
        };
        if (mode === 'crop-pdf') opts.rect = rectangle();
        if (overlay) {
          validateBatch([overlay], /\.(png|jpe?g)$/i);
          opts.image = new Uint8Array(await overlay.arrayBuffer());
          opts.imageType = overlay.type;
        } else if (mode === 'sign-pdf' && signature) {
          opts.image = new Uint8Array(
            await (await encode(pad, 'image/png', 1)).arrayBuffer(),
          );
          opts.imageType = 'image/png';
        }
        bytes = await api.assemblePDF(sources, keep, opts);
      }
      if (bytes)
        results.push({
          name: mode + '-kittysuite.pdf',
          blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }),
        });
      for (const result of results) output.add(result.blob, result.name);
      if (results.length > 1)
        output.add(await zipOutputs(results), mode + '-kittysuite.zip');
      const original = files.reduce((n, f) => n + f.size, 0),
        total = results.reduce((n, r) => n + r.blob.size, 0);
      status(
        `Exported ${results.length} file(s). Original: ${size(original)}. Result: ${size(total)}. ${total < original ? ((1 - total / original) * 100).toFixed(1) + '% smaller.' : 'No saving; output is ' + ((total / original - 1) * 100).toFixed(1) + '% larger.'}${mode === 'redact-pdf' ? ' Original PDF objects discarded. Review all rebuilt pages.' : ''}`,
      );
    } catch (e) {
      status(friendlyError(e));
    } finally {
      busy = false;
      get<HTMLButtonElement>('pdf-export').disabled = false;
      get<HTMLButtonElement>('pdf-reset').disabled = false;
    }
  });
  get('scan-crop')?.addEventListener('click', () => {
    try {
      const page = pages[active],
        image = images[page.source];
      const rect = {
        x: (num('scan-x') / 100) * image.naturalWidth,
        y: (num('scan-y') / 100) * image.naturalHeight,
        w: (num('scan-w') / 100) * image.naturalWidth,
        h: (num('scan-h') / 100) * image.naturalHeight,
      };
      const c = editImage(image, {
        mode: 'crop-image',
        rect,
        mime: 'image/png',
      });
      page.crop = rect;
      if (baseCanvas) baseCanvas.width = baseCanvas.height = 0;
      baseCanvas = c;
      paint();
      status('Crop saved for this scan.');
    } catch (e) {
      status(friendlyError(e));
    }
  });
  function stopCamera() {
    stream?.getTracks().forEach((track) => track.stop());
    stream = undefined;
    const video = get<HTMLVideoElement>('scan-video');
    if (video) {
      video.srcObject = null;
      video.hidden = true;
      get('camera-capture').hidden = get('camera-stop').hidden = true;
    }
  }
  get('camera-start')?.addEventListener('click', async () => {
    try {
      stopCamera();
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      const video = get<HTMLVideoElement>('scan-video');
      video.srcObject = stream;
      video.hidden = false;
      get('camera-capture').hidden = get('camera-stop').hidden = false;
    } catch {
      status(
        'Camera unavailable or permission declined. You can choose existing images instead.',
      );
    }
  });
  get('camera-stop')?.addEventListener('click', stopCamera);
  get('camera-capture')?.addEventListener('click', async () => {
    try {
      const v = get<HTMLVideoElement>('scan-video'),
        c = document.createElement('canvas');
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      if (!c.width) throw new Error('Wait for the camera preview.');
      c.getContext('2d')!.drawImage(v, 0, 0);
      const blob = await encode(c, 'image/jpeg', 0.9);
      c.width = c.height = 0;
      await select([
        new File([blob], `scan-${Date.now()}.jpg`, { type: 'image/jpeg' }),
      ]);
    } catch (e) {
      status(friendlyError(e));
    }
  });
  async function release(reset = true) {
    output.clear();
    stopCamera();
    for (const doc of docs) await doc.loadingTask.destroy();
    docs = [];
    images.forEach((image) => image.removeAttribute('src'));
    images = [];
    sources = [];
    files = [];
    pages = [];
    shapes = [];
    redactions = {};
    overlay = undefined;
    overlayPreview?.removeAttribute('src');
    overlayPreview = undefined;
    signature = false;
    if (pad) pad.getContext('2d')!.clearRect(0, 0, pad.width, pad.height);
    urls.splice(0).forEach((url) => URL.revokeObjectURL(url));
    output.clear();
    if (baseCanvas) baseCanvas.width = baseCanvas.height = 0;
    baseCanvas = undefined;
    canvas.width = canvas.height = 0;
    if (reset) {
      generation++;
      get('pdf-editor').hidden = true;
      get<HTMLInputElement>('pdf-files').value = '';
      status('Choose files to start again.');
    }
  }
  get('pdf-reset').onclick = () => {
    if (!busy) void release();
  };
  window.addEventListener('pagehide', () => {
    generation++;
    void release();
  });
}
