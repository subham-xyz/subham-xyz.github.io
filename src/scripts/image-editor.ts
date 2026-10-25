import {
  decodeImage,
  editImage,
  animatedGIF,
  cropBounds,
} from './image-edit-core.mjs';
import { encode, size } from './image-core.mjs';
import {
  bindDrop,
  downloads,
  validateBatch,
  zipOutputs,
  friendlyError,
  pausePaint,
} from './local-files';
import { bindSidebar } from './sidebar-ui';
import { resultView } from './result-view';
import { setKittyState } from './tool-state';

if (document.getElementById('image-editor')) {
  const root = document.getElementById('image-editor')!;
  const mode = root.dataset.mode!;
  const get = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const val = (id: string, fallback = '') =>
    get<HTMLInputElement>(id)?.value ?? fallback;
  const num = (id: string, fallback = 0) => {
    const n = Number(val(id, String(fallback)));
    return Number.isFinite(n) ? n : fallback;
  };
  const checked = (id: string) => get<HTMLInputElement>(id)?.checked;
  const status = (text: string) => (get('local-status').textContent = text);
  const output = downloads(get('local-output'));
  const result = resultView('local', root);
  const editor = get('local-editor'),
    upload = get('edit-upload');
  let images: HTMLImageElement[] = [],
    files: File[] = [],
    current = 0,
    overlay: HTMLImageElement | undefined,
    regions: any[] = [],
    busy = false;
  const canvas = get<HTMLCanvasElement>('edit-preview');
  let previewCanvas: HTMLCanvasElement | undefined;
  const suffix: Record<string, string> = {
    'crop-image': 'cropped',
    'rotate-image': 'rotated',
    'meme-generator': 'meme',
    'photo-editor': 'edited',
    'watermark-image': 'watermarked',
    'blur-face': 'blurred',
    'convert-to-jpg': '',
    'convert-from-jpg': '',
  };
  const sidebar = bindSidebar(root, () => {
    output.clear();
    render();
  });

  function outputMime(file?: File) {
    const chosen = val('edit-format', 'image/png');
    if (chosen !== 'auto') return chosen;
    const type = file?.type || '';
    return ['image/jpeg', 'image/png', 'image/webp'].includes(type)
      ? type
      : 'image/png';
  }
  function filter() {
    if (mode !== 'photo-editor') return 'none';
    const preset = val('effect', 'none');
    const adjust = `brightness(${num('adj-brightness', 100) / 100}) contrast(${num('adj-contrast', 100) / 100}) saturate(${num('adj-saturation', 100) / 100})`;
    return preset === 'none' ? adjust : `${preset} ${adjust}`;
  }
  function options(image = images[current]) {
    const base = image
      ? Math.min(image.naturalWidth, image.naturalHeight)
      : 1000;
    const imageMark =
      mode === 'watermark-image' && sidebar.activeTab() === 'image';
    return {
      mode,
      mime: outputMime(files[current]),
      rect: {
        x: num('edit-x'),
        y: num('edit-y'),
        w: num('edit-w'),
        h: num('edit-h'),
      },
      angle: num('angle'),
      text: val('edit-text'),
      bottom: val('bottom-text'),
      fontSize: Math.max(8, Math.round((base * num('font-size', 8)) / 100)),
      font: val('text-font'),
      align: 'center',
      color: val('text-color', '#ffffff'),
      outline: checked('text-outline'),
      x: num('stamp-x', 50) / 100,
      y: num('stamp-y', 50) / 100,
      opacity: num('stamp-opacity', 100) / 100,
      stampRotation: num('stamp-rotation'),
      overlay: imageMark ? overlay : undefined,
      scale: num('stamp-scale', 30) / 100,
      tile: checked('stamp-tile'),
      filter: filter(),
      frame: num('frame-size'),
      frameColor: val('frame-color', '#ffffff'),
      sticker: checked('loki-sticker'),
      background: '#ffffff',
      regions,
      blur: num('blur-size', 24),
    };
  }
  // Rotate Image can be limited to portrait or landscape photos.
  function orientationMatches(image: HTMLImageElement) {
    const filter = val('orientation-filter', 'all');
    if (filter === 'all') return true;
    const landscape = image.naturalWidth > image.naturalHeight;
    return filter === 'landscape'
      ? landscape
      : image.naturalHeight > image.naturalWidth;
  }
  // Dims everything outside the crop and draws corner handles.
  function paintCropBox(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    rect: any,
    scale: number,
  ) {
    const r = cropBounds(rect, image.naturalWidth, image.naturalHeight);
    const box: [number, number, number, number] = [
      r.x * scale,
      r.y * scale,
      r.w * scale,
      r.h * scale,
    ];
    ctx.fillStyle = 'rgb(0 0 0 / .45)';
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.rect(...box);
    ctx.fill('evenodd');
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(...box);
    ctx.fillStyle = '#ffffff';
    for (const x of [r.x, r.x + r.w])
      for (const y of [r.y, r.y + r.h]) {
        ctx.beginPath();
        ctx.arc(x * scale, y * scale, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    get('crop-readout')?.replaceChildren(`${r.w} × ${r.h} px`);
  }
  function drawPreview(image: HTMLImageElement) {
    const opts = options(image);
    previewCanvas = editImage(image, {
      ...opts,
      angle: orientationMatches(image) ? opts.angle : 0,
      mode: mode === 'crop-image' ? 'preview' : mode,
    });
    const scale = Math.min(
      1,
      1100 / previewCanvas.width,
      1100 / previewCanvas.height,
    );
    canvas.width = Math.round(previewCanvas.width * scale);
    canvas.height = Math.round(previewCanvas.height * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(previewCanvas, 0, 0, canvas.width, canvas.height);
    if (mode === 'crop-image') paintCropBox(ctx, image, opts.rect, scale);
  }
  function render() {
    const image = images[current];
    if (!image) return;
    try {
      previewCanvas?.remove();
      if (previewCanvas) previewCanvas.width = previewCanvas.height = 0;
      drawPreview(image);
      if (mode === 'rotate-image')
        get('angle-readout').textContent =
          `${((num('angle') % 360) + 360) % 360}°`;
    } catch (e) {
      status(friendlyError(e));
    }
  }
  const thumbs = new WeakMap<HTMLImageElement, string>();
  function thumbnail(image: HTMLImageElement) {
    let url = thumbs.get(image);
    if (!url) {
      const c = document.createElement('canvas');
      const s = Math.min(
        1,
        160 / image.naturalWidth,
        160 / image.naturalHeight,
      );
      c.width = Math.max(1, Math.round(image.naturalWidth * s));
      c.height = Math.max(1, Math.round(image.naturalHeight * s));
      c.getContext('2d')!.drawImage(image, 0, 0, c.width, c.height);
      url = c.toDataURL('image/jpeg', 0.7);
      c.width = c.height = 0;
      thumbs.set(image, url);
    }
    return url;
  }
  function strip() {
    if (files.length < 2) {
      get('image-order').hidden = true;
      get('image-order').replaceChildren();
      return;
    }
    const box = get('image-order');
    box.hidden = false;
    box.replaceChildren(...files.map(stripItem));
  }
  function showImage(i: number) {
    current = i;
    strip();
    render();
  }
  // Earlier/Later buttons reorder GIF frames.
  function moveButton(file: File, i: number, delta: number) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = delta < 0 ? '←' : '→';
    button.className = 'strip-move';
    button.setAttribute(
      'aria-label',
      `Move ${file.name} ${delta < 0 ? 'earlier' : 'later'}`,
    );
    button.disabled = i + delta < 0 || i + delta >= files.length;
    button.onclick = () => {
      [files[i], files[i + delta]] = [files[i + delta], files[i]];
      [images[i], images[i + delta]] = [images[i + delta], images[i]];
      showImage(i + delta);
    };
    return button;
  }
  function stripItem(file: File, i: number) {
    const item = document.createElement('div');
    item.className = 'strip-item' + (i === current ? ' active' : '');
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'strip-thumb';
    thumb.setAttribute('aria-label', `Preview ${i + 1}. ${file.name}`);
    const img = document.createElement('img');
    img.alt = '';
    img.src = thumbnail(images[i]);
    thumb.append(img);
    thumb.onclick = () => showImage(i);
    const label = document.createElement('span');
    label.className = 'strip-name';
    label.textContent = `${i + 1}. ${file.name}`;
    item.append(thumb, label);
    if (mode === 'convert-from-jpg')
      item.append(moveButton(file, i, -1), moveButton(file, i, 1));
    return item;
  }
  const BATCH_MODES = ['rotate-image', 'convert-from-jpg'];
  async function decodeAll(selected: File[]) {
    validateBatch(selected, /\.(png|jpe?g|webp|gif|bmp|avif|svg|tiff?)$/i);
    if (!BATCH_MODES.includes(mode) && selected.length !== 1)
      throw new Error('Choose one image for this tool.');
    status('Reading images locally...');
    setKittyState(root, 'processing');
    const decoded = [];
    for (const file of selected) {
      decoded.push(await decodeImage(file));
      const pixels = decoded.reduce(
        (n, img) => n + img.naturalWidth * img.naturalHeight,
        0,
      );
      if (pixels > 40000000)
        throw new Error(
          'Use a smaller batch: decoded images are limited to 40 megapixels total.',
        );
    }
    return decoded;
  }
  // Crop starts 10% inside the edges; other tools use the whole image.
  function resetBox() {
    const inset = mode === 'crop-image' ? 0.1 : 0;
    const iw = images[0].naturalWidth,
      ih = images[0].naturalHeight;
    const values: Record<string, number> = {
      x: Math.round(iw * inset),
      y: Math.round(ih * inset),
      w: Math.round(iw * (1 - inset * 2)),
      h: Math.round(ih * (1 - inset * 2)),
    };
    for (const [id, n] of Object.entries(values))
      if (get('edit-' + id))
        get<HTMLInputElement>('edit-' + id).value = String(n);
  }
  function openEditor() {
    result.hide();
    upload.hidden = true;
    editor.hidden = false;
    strip();
    render();
    setKittyState(root, 'idle');
    const label = files.length > 1 ? files.length + ' images' : files[0].name;
    status(
      `Ready. ${label} · ${images[0].naturalWidth} × ${images[0].naturalHeight} px`,
    );
  }
  bindDrop(get<HTMLInputElement>('local-files'), async (selected) => {
    if (busy) return;
    busy = true;
    output.clear();
    try {
      const decoded = await decodeAll(selected);
      images.forEach((i) => i.removeAttribute('src'));
      images = decoded;
      files = selected;
      current = 0;
      regions = [];
      resetBox();
      openEditor();
    } catch (e) {
      setKittyState(root, 'error');
      status(friendlyError(e));
    } finally {
      busy = false;
    }
  });
  get('crop-ratio')?.addEventListener('change', () => {
    const r = num('crop-ratio');
    const image = images[current];
    if (r && image) {
      const w = Math.min(image.naturalWidth, image.naturalHeight * r),
        h = w / r;
      get<HTMLInputElement>('edit-x').value = String(
        Math.round((image.naturalWidth - w) / 2),
      );
      get<HTMLInputElement>('edit-y').value = String(
        Math.round((image.naturalHeight - h) / 2),
      );
      get<HTMLInputElement>('edit-w').value = String(Math.round(w));
      get<HTMLInputElement>('edit-h').value = String(Math.round(h));
      render();
    }
  });
  root.querySelectorAll<HTMLButtonElement>('[data-rotate]').forEach((button) =>
    button.addEventListener('click', () => {
      const angle = get<HTMLInputElement>('angle');
      const next = (num('angle') + Number(button.dataset.rotate)) % 360;
      angle.value = String(
        next === 0 && button.dataset.rotate !== '180' ? 0 : next,
      );
      angle.dispatchEvent(new Event('input', { bubbles: true }));
    }),
  );
  const syncFormat = () => {
    const gif = val('edit-format') === 'image/gif';
    if (get('gif-options')) get('gif-options').hidden = !gif;
    if (get('frame-delay-value'))
      get('frame-delay-value').textContent =
        `${(num('frame-delay', 500) / 1000).toFixed(1)} s`;
  };
  get('edit-format')?.addEventListener('change', syncFormat);
  get('edit-format')?.addEventListener('input', syncFormat);
  get('frame-delay')?.addEventListener('input', syncFormat);
  get('overlay-file')?.addEventListener('change', async () => {
    try {
      const file = get<HTMLInputElement>('overlay-file').files?.[0];
      if (file) {
        validateBatch([file], /\.(png|jpe?g|webp)$/i);
        overlay = await decodeImage(file);
        get('overlay-name').textContent = `Using ${file.name}`;
        render();
      }
    } catch (e) {
      status(friendlyError(e));
    }
  });
  get('add-blur')?.addEventListener('click', () => {
    try {
      regions.push(
        cropBounds(
          options().rect,
          images[current].naturalWidth,
          images[current].naturalHeight,
        ),
      );
      render();
    } catch (e) {
      status(friendlyError(e));
    }
  });
  get('undo-blur')?.addEventListener('click', () => {
    // A brush stroke adds many dabs; remove the whole last stroke.
    const last = regions[regions.length - 1];
    if (last?.stroke !== undefined) {
      const id = last.stroke;
      regions = regions.filter((r) => r.stroke !== id);
    } else regions.pop();
    render();
  });
  get('clear-blur')?.addEventListener('click', () => {
    regions = [];
    render();
  });
  // Clicking the preview places text or a watermark.
  let drag: { x: number; y: number; rect: any; corner: string } | undefined;
  let strokeId = 0;
  function point(event: PointerEvent) {
    const box = canvas.getBoundingClientRect();
    const image = images[current];
    return {
      x: Math.round(
        Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)) *
          image.naturalWidth,
      ),
      y: Math.round(
        Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)) *
          image.naturalHeight,
      ),
      fx: (event.clientX - box.left) / box.width,
      fy: (event.clientY - box.top) / box.height,
    };
  }
  canvas.addEventListener('pointerdown', (event) => {
    if (!images.length) return;
    const p = point(event);
    if (['photo-editor', 'watermark-image'].includes(mode) && get('stamp-x')) {
      get<HTMLInputElement>('stamp-x').value = String(Math.round(p.fx * 100));
      get<HTMLInputElement>('stamp-y').value = String(Math.round(p.fy * 100));
      sidebar.clearPosition();
      render();
      return;
    }
    if (!['crop-image', 'blur-face'].includes(mode)) return;
    const r = options().rect;
    strokeId++;
    drag = { ...p, rect: r, corner: grabbedCorner(p, r) };
    canvas.setPointerCapture(event.pointerId);
  });
  type Point = { x: number; y: number };
  type Drag = NonNullable<typeof drag>;
  // Which crop edges the pointer grabbed (e.g. "lefttop"), or "" to move the box.
  function grabbedCorner(p: Point, r: any) {
    const near = (a: number, b: number) => Math.abs(a - b) < 40;
    const horizontal = near(p.x, r.x)
      ? 'left'
      : near(p.x, r.x + r.w)
        ? 'right'
        : '';
    const vertical = near(p.y, r.y)
      ? 'top'
      : near(p.y, r.y + r.h)
        ? 'bottom'
        : '';
    return horizontal + vertical;
  }
  function brushDab(p: Point) {
    const size = num('blur-size', 24) * 3;
    regions.push({
      x: p.x,
      y: p.y,
      w: size,
      h: size,
      brush: true,
      stroke: strokeId,
    });
  }
  // Moving the whole crop box, kept inside the image.
  function movedRect(d: Drag, p: Point, image: HTMLImageElement) {
    return {
      ...d.rect,
      x: Math.max(
        0,
        Math.min(image.naturalWidth - d.rect.w, d.rect.x + p.x - d.x),
      ),
      y: Math.max(
        0,
        Math.min(image.naturalHeight - d.rect.h, d.rect.y + p.y - d.y),
      ),
    };
  }
  // The corner that stays put while resizing (blur boxes grow from where the drag began).
  function anchorPoint(d: Drag) {
    if (mode !== 'crop-image') return { x: d.x, y: d.y };
    return {
      x: d.corner.startsWith('left') ? d.rect.x + d.rect.w : d.rect.x,
      y: d.corner.endsWith('top') ? d.rect.y + d.rect.h : d.rect.y,
    };
  }
  function resizedRect(d: Drag, p: Point, image: HTMLImageElement) {
    const fixed = anchorPoint(d);
    let w = Math.max(1, Math.abs(p.x - fixed.x)),
      h = Math.max(1, Math.abs(p.y - fixed.y));
    const ratio = num('crop-ratio');
    if (ratio) {
      h = Math.round(w / ratio);
      const limit = p.y < fixed.y ? fixed.y : image.naturalHeight - fixed.y;
      if (h > limit) {
        h = limit;
        w = Math.round(h * ratio);
      }
    }
    return {
      x: p.x < fixed.x ? fixed.x - w : fixed.x,
      y: p.y < fixed.y ? fixed.y - h : fixed.y,
      w,
      h,
    };
  }
  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const image = images[current];
    const p = point(event);
    if (mode === 'blur-face' && val('blur-mode') === 'brush') {
      brushDab(p);
      render();
      return;
    }
    const moving =
      mode === 'crop-image' && !/^(left|right)(top|bottom)$/.test(drag.corner);
    const r: any = moving
      ? movedRect(drag, p, image)
      : resizedRect(drag, p, image);
    for (const key of ['x', 'y', 'w', 'h'])
      get<HTMLInputElement>('edit-' + key).value = String(r[key]);
    render();
  });
  canvas.addEventListener('pointerup', () => {
    if (drag && mode === 'blur-face' && val('blur-mode') === 'rectangle')
      try {
        regions.push(options().rect);
      } catch {}
    drag = undefined;
    render();
  });
  canvas.addEventListener('pointercancel', () => {
    drag = undefined;
  });
  type Output = { name: string; blob: Blob };
  // One edited image, encoded in its output format.
  async function exportImage(
    img: HTMLImageElement,
    file: File,
  ): Promise<Output> {
    const opts = options(img);
    const mime = outputMime(file);
    const c = editImage(img, {
      ...opts,
      mime,
      angle: orientationMatches(img) ? opts.angle : 0,
    });
    try {
      const ext = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1];
      const base = file.name.replace(/\.[^.]+$/, '') || 'image';
      const quality =
        mode === 'convert-to-jpg' ? num('jpg-quality', 90) / 100 : 0.92;
      return {
        name: `${base}${suffix[mode] ? '-' + suffix[mode] : ''}.${ext}`,
        blob: await encode(c, mime, quality),
      };
    } finally {
      c.width = c.height = 0;
    }
  }
  async function exportAll(): Promise<Output[]> {
    if (val('edit-format') === 'image/gif')
      return [
        {
          name: 'animation.gif',
          blob: await animatedGIF(
            images,
            num('frame-delay', 500),
            checked('gif-loop'),
          ),
        },
      ];
    const results = [];
    for (let i = 0; i < images.length; i++) {
      results.push(await exportImage(images[i], files[i]));
      await pausePaint();
    }
    return results;
  }
  async function showResults(results: Output[]) {
    const urls = results.map((item) => output.add(item.blob, item.name));
    const zip = results.length > 1 ? await zipOutputs(results) : undefined;
    const total = results.reduce((n, r) => n + r.blob.size, 0);
    status(
      `Done: ${results.length} file(s), ${size(total)}. Original metadata removed.`,
    );
    result.show(results, urls, {
      zip,
      zipName: `${suffix[mode] || 'converted'}-images.zip`,
      summary: `${results.length} file${results.length > 1 ? 's' : ''} · ${size(total)} · metadata removed`,
      editor,
      upload,
    });
  }
  function setBusy(on: boolean) {
    busy = on;
    get<HTMLButtonElement>('edit-export').disabled = on;
    get<HTMLButtonElement>('edit-reset').disabled = on;
  }
  get('edit-export').addEventListener('click', async () => {
    if (busy || !images.length) return;
    if (mode === 'blur-face' && !regions.length) {
      status('Drag over the area you want to blur first.');
      return;
    }
    setBusy(true);
    output.clear();
    setKittyState(root, 'processing');
    try {
      status('Working on your device...');
      await pausePaint();
      await showResults(await exportAll());
    } catch (e) {
      setKittyState(root, 'error');
      status(friendlyError(e));
    } finally {
      setBusy(false);
    }
  });
  result.onBack(() => {
    result.hide();
    editor.hidden = false;
    status('Back to editing. Change anything and export again.');
    get('edit-export').focus();
  });
  function reset() {
    images.forEach((img) => img.removeAttribute('src'));
    images = [];
    files = [];
    current = 0;
    overlay?.removeAttribute('src');
    overlay = undefined;
    regions = [];
    output.clear();
    result.hide();
    canvas.width = canvas.height = 0;
    if (previewCanvas) previewCanvas.width = previewCanvas.height = 0;
    editor.hidden = true;
    upload.hidden = false;
    get<HTMLInputElement>('local-files').value = '';
    status('Choose another image.');
  }
  get('edit-reset').addEventListener('click', reset);
  result.onStartOver(() => {
    reset();
    get<HTMLLabelElement>('local-files').focus();
  });
  window.addEventListener('pagehide', reset);
  syncFormat();
}
