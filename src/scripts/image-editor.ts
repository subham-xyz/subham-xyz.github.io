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
  function render() {
    const image = images[current];
    if (!image) return;
    try {
      previewCanvas?.remove();
      if (previewCanvas) previewCanvas.width = previewCanvas.height = 0;
      const opts = options(image);
      const filterApplies =
        val('orientation-filter', 'all') === 'all' ||
        (val('orientation-filter') === 'landscape'
          ? image.naturalWidth > image.naturalHeight
          : image.naturalHeight > image.naturalWidth);
      previewCanvas = editImage(image, {
        ...opts,
        angle: filterApplies ? opts.angle : 0,
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
      if (mode === 'crop-image') {
        const r = cropBounds(
          opts.rect,
          image.naturalWidth,
          image.naturalHeight,
        );
        ctx.fillStyle = 'rgb(0 0 0 / .45)';
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.rect(r.x * scale, r.y * scale, r.w * scale, r.h * scale);
        ctx.fill('evenodd');
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(r.x * scale, r.y * scale, r.w * scale, r.h * scale);
        ctx.fillStyle = '#ffffff';
        for (const x of [r.x, r.x + r.w])
          for (const y of [r.y, r.y + r.h]) {
            ctx.beginPath();
            ctx.arc(x * scale, y * scale, 7, 0, Math.PI * 2);
            ctx.fill();
          }
        get('crop-readout')?.replaceChildren(`${r.w} × ${r.h} px`);
      }
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
    box.hidden = files.length < 2;
    box.replaceChildren(
      ...files.map((file, i) => {
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
        thumb.onclick = () => {
          current = i;
          strip();
          render();
        };
        const label = document.createElement('span');
        label.className = 'strip-name';
        label.textContent = `${i + 1}. ${file.name}`;
        item.append(thumb, label);
        if (mode === 'convert-from-jpg') {
          for (const [text, delta, name] of [
            ['←', -1, 'Earlier'],
            ['→', 1, 'Later'],
          ] as const) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = text;
            button.className = 'strip-move';
            button.setAttribute(
              'aria-label',
              `Move ${file.name} ${name.toLowerCase()}`,
            );
            button.disabled = i + delta < 0 || i + delta >= files.length;
            button.onclick = () => {
              [files[i], files[i + delta]] = [files[i + delta], files[i]];
              [images[i], images[i + delta]] = [images[i + delta], images[i]];
              current = i + delta;
              strip();
              render();
            };
            item.append(button);
          }
        }
        return item;
      }),
    );
  }
  bindDrop(get<HTMLInputElement>('local-files'), async (selected) => {
    if (busy) return;
    busy = true;
    output.clear();
    try {
      validateBatch(selected, /\.(png|jpe?g|webp|gif|bmp|avif|svg|tiff?)$/i);
      if (
        !['rotate-image', 'convert-from-jpg'].includes(mode) &&
        selected.length !== 1
      )
        throw new Error('Choose one image for this tool.');
      status('Reading images locally...');
      setKittyState(root, 'processing');
      const decoded = [];
      for (const file of selected) {
        decoded.push(await decodeImage(file));
        if (
          decoded.reduce(
            (n, img) => n + img.naturalWidth * img.naturalHeight,
            0,
          ) > 40000000
        )
          throw new Error(
            'Use a smaller batch: decoded images are limited to 40 megapixels total.',
          );
      }
      images.forEach((i) => i.removeAttribute('src'));
      images = decoded;
      files = selected;
      current = 0;
      regions = [];
      const inset = mode === 'crop-image' ? 0.1 : 0;
      const iw = images[0].naturalWidth,
        ih = images[0].naturalHeight;
      for (const [id, n] of [
        ['x', Math.round(iw * inset)],
        ['y', Math.round(ih * inset)],
        ['w', Math.round(iw * (1 - inset * 2))],
        ['h', Math.round(ih * (1 - inset * 2))],
      ])
        if (get('edit-' + id))
          get<HTMLInputElement>('edit-' + id).value = String(n);
      result.hide();
      upload.hidden = true;
      editor.hidden = false;
      strip();
      render();
      setKittyState(root, 'idle');
      status(
        `Ready. ${files.length > 1 ? files.length + ' images' : files[0].name} · ${images[0].naturalWidth} × ${images[0].naturalHeight} px`,
      );
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
    drag = {
      ...p,
      rect: r,
      corner:
        (Math.abs(p.x - r.x) < 40
          ? 'left'
          : Math.abs(p.x - r.x - r.w) < 40
            ? 'right'
            : '') +
        (Math.abs(p.y - r.y) < 40
          ? 'top'
          : Math.abs(p.y - r.y - r.h) < 40
            ? 'bottom'
            : ''),
    };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const image = images[current];
    const p = point(event);
    if (mode === 'blur-face' && val('blur-mode') === 'brush') {
      regions.push({
        x: p.x,
        y: p.y,
        w: num('blur-size', 24) * 3,
        h: num('blur-size', 24) * 3,
        brush: true,
        stroke: strokeId,
      });
      render();
      return;
    }
    let r;
    if (
      mode === 'crop-image' &&
      !/^(left|right)(top|bottom)$/.test(drag.corner)
    ) {
      r = {
        ...drag.rect,
        x: Math.max(
          0,
          Math.min(
            image.naturalWidth - drag.rect.w,
            drag.rect.x + p.x - drag.x,
          ),
        ),
        y: Math.max(
          0,
          Math.min(
            image.naturalHeight - drag.rect.h,
            drag.rect.y + p.y - drag.y,
          ),
        ),
      };
    } else {
      const fixedX =
        mode === 'crop-image'
          ? drag.corner.startsWith('left')
            ? drag.rect.x + drag.rect.w
            : drag.rect.x
          : drag.x;
      const fixedY =
        mode === 'crop-image'
          ? drag.corner.endsWith('top')
            ? drag.rect.y + drag.rect.h
            : drag.rect.y
          : drag.y;
      let w = Math.max(1, Math.abs(p.x - fixedX)),
        h = Math.max(1, Math.abs(p.y - fixedY));
      const ratio = num('crop-ratio');
      if (ratio) {
        h = Math.round(w / ratio);
        const limit = p.y < fixedY ? fixedY : image.naturalHeight - fixedY;
        if (h > limit) {
          h = limit;
          w = Math.round(h * ratio);
        }
      }
      r = {
        x: p.x < fixedX ? fixedX - w : fixedX,
        y: p.y < fixedY ? fixedY - h : fixedY,
        w,
        h,
      };
    }
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
  get('edit-export').addEventListener('click', async () => {
    if (busy || !images.length) return;
    if (mode === 'blur-face' && !regions.length) {
      status('Drag over the area you want to blur first.');
      return;
    }
    busy = true;
    get<HTMLButtonElement>('edit-export').disabled = true;
    get<HTMLButtonElement>('edit-reset').disabled = true;
    output.clear();
    setKittyState(root, 'processing');
    try {
      status('Working on your device...');
      await pausePaint();
      const results: { name: string; blob: Blob }[] = [];
      if (val('edit-format') === 'image/gif')
        results.push({
          name: 'animation.gif',
          blob: await animatedGIF(
            images,
            num('frame-delay', 500),
            checked('gif-loop'),
          ),
        });
      else
        for (let i = 0; i < images.length; i++) {
          const img = images[i];
          const opts = options(img);
          const mime = outputMime(files[i]);
          const filterValue = val('orientation-filter', 'all');
          const applies =
            filterValue === 'all' ||
            (filterValue === 'landscape'
              ? img.naturalWidth > img.naturalHeight
              : img.naturalHeight > img.naturalWidth);
          const c = editImage(img, {
            ...opts,
            mime,
            angle: applies ? opts.angle : 0,
          });
          try {
            const ext = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1];
            const base = files[i].name.replace(/\.[^.]+$/, '') || 'image';
            results.push({
              name: `${base}${suffix[mode] ? '-' + suffix[mode] : ''}.${ext}`,
              blob: await encode(
                c,
                mime,
                mode === 'convert-to-jpg' ? num('jpg-quality', 90) / 100 : 0.92,
              ),
            });
          } finally {
            c.width = c.height = 0;
          }
          await pausePaint();
        }
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
    } catch (e) {
      setKittyState(root, 'error');
      status(friendlyError(e));
    } finally {
      busy = false;
      get<HTMLButtonElement>('edit-export').disabled = false;
      get<HTMLButtonElement>('edit-reset').disabled = false;
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
