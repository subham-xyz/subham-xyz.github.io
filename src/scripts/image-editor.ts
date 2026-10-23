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
if (document.getElementById('image-editor')) {
  const root = document.getElementById('image-editor')!;
  const mode = root.dataset.mode!;
  const get = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const val = (id: string, fallback = '') =>
    get<HTMLInputElement>(id)?.value ?? fallback;
  const num = (id: string, fallback = 0) => Number(val(id, String(fallback)));
  const checked = (id: string) => get<HTMLInputElement>(id)?.checked;
  const status = (text: string) => (get('local-status').textContent = text);
  const output = downloads(get('local-output'));
  let images: HTMLImageElement[] = [],
    files: File[] = [],
    overlay: HTMLImageElement | undefined,
    regions: any[] = [],
    busy = false;
  const canvas = get<HTMLCanvasElement>('edit-preview');
  let previewCanvas: HTMLCanvasElement | undefined;
  function options() {
    return {
      mode,
      mime: val('edit-format'),
      rect: {
        x: num('edit-x'),
        y: num('edit-y'),
        w: num('edit-w'),
        h: num('edit-h'),
      },
      angle: num('angle'),
      text: val('edit-text'),
      bottom: val('bottom-text'),
      fontSize: num('font-size', 40),
      font: val('text-font'),
      align: val('text-align'),
      color: val('text-color', '#ffffff'),
      outline: checked('text-outline'),
      x: num('stamp-x', 50) / 100,
      y: num('stamp-y', 50) / 100,
      opacity: num('stamp-opacity', 100) / 100,
      stampRotation: num('stamp-rotation'),
      overlay,
      scale: num('stamp-scale', 30) / 100,
      tile: checked('stamp-tile'),
      filter: val('effect', 'none'),
      frame: num('frame-size'),
      sticker: checked('loki-sticker'),
      background: val('edit-background', '#ffffff'),
      regions,
      blur: num('blur-size', 24),
    };
  }
  function render() {
    if (!images.length) return;
    try {
      previewCanvas?.remove();
      if (previewCanvas) previewCanvas.width = previewCanvas.height = 0;
      const opts = options();
      previewCanvas = editImage(images[0], {
        ...opts,
        mode: mode === 'crop-image' ? 'preview' : mode,
      });
      const scale = Math.min(
        1,
        900 / previewCanvas.width,
        900 / previewCanvas.height,
      );
      canvas.width = Math.round(previewCanvas.width * scale);
      canvas.height = Math.round(previewCanvas.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(previewCanvas, 0, 0, canvas.width, canvas.height);
      if (mode === 'crop-image') {
        const r = cropBounds(
          opts.rect,
          images[0].naturalWidth,
          images[0].naturalHeight,
        );
        ctx.strokeStyle = '#008080';
        ctx.lineWidth = 3;
        ctx.strokeRect(r.x * scale, r.y * scale, r.w * scale, r.h * scale);
        ctx.fillStyle = '#008080';
        for (const x of [r.x, r.x + r.w])
          for (const y of [r.y, r.y + r.h])
            ctx.fillRect(x * scale - 6, y * scale - 6, 12, 12);
      }
    } catch (e) {
      status(friendlyError(e));
    }
  }
  function order() {
    get('image-order').replaceChildren(
      ...files.map((file, i) => {
        const box = document.createElement('div');
        const label = document.createElement('span');
        label.textContent = `${i + 1}. ${file.name}`;
        box.append(label);
        for (const [text, delta] of [
          ['Earlier', -1],
          ['Later', 1],
        ] as const) {
          const button = document.createElement('button');
          button.textContent = text;
          button.className = 'text-link';
          button.disabled = i + delta < 0 || i + delta >= files.length;
          button.onclick = () => {
            [files[i], files[i + delta]] = [files[i + delta], files[i]];
            [images[i], images[i + delta]] = [images[i + delta], images[i]];
            order();
            render();
          };
          box.append(button);
        }
        return box;
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
      regions = [];
      for (const [id, n] of [
        ['x', 0],
        ['y', 0],
        ['w', images[0].naturalWidth],
        ['h', images[0].naturalHeight],
      ])
        if (get('edit-' + id))
          get<HTMLInputElement>('edit-' + id).value = String(n);
      get('local-editor').hidden = false;
      order();
      render();
      status('Ready. Edit, preview, then export.');
    } catch (e) {
      status(friendlyError(e));
    } finally {
      busy = false;
    }
  });
  root.querySelectorAll('input:not([type=file]),select').forEach((el) =>
    el.addEventListener('input', () => {
      output.clear();
      render();
    }),
  );
  get('crop-ratio')?.addEventListener('change', () => {
    const r = num('crop-ratio');
    if (r && images.length) {
      const w = Math.min(images[0].naturalWidth, images[0].naturalHeight * r);
      get<HTMLInputElement>('edit-x').value = '0';
      get<HTMLInputElement>('edit-y').value = '0';
      get<HTMLInputElement>('edit-w').value = String(Math.round(w));
      get<HTMLInputElement>('edit-h').value = String(Math.round(w / r));
      render();
    }
  });
  get('overlay-file')?.addEventListener('change', async () => {
    try {
      const file = get<HTMLInputElement>('overlay-file').files?.[0];
      if (file) {
        validateBatch([file], /\.(png|jpe?g|webp)$/i);
        overlay = await decodeImage(file);
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
          images[0].naturalWidth,
          images[0].naturalHeight,
        ),
      );
      render();
    } catch (e) {
      status(friendlyError(e));
    }
  });
  get('clear-blur')?.addEventListener('click', () => {
    regions = [];
    render();
  });
  let drag: { x: number; y: number; rect: any; corner: string } | undefined;
  function point(event: PointerEvent) {
    const box = canvas.getBoundingClientRect();
    return {
      x: Math.round(
        Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)) *
          images[0].naturalWidth,
      ),
      y: Math.round(
        Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)) *
          images[0].naturalHeight,
      ),
    };
  }
  canvas.addEventListener('pointerdown', (event) => {
    if (!images.length || !['crop-image', 'blur-face'].includes(mode)) return;
    const p = point(event),
      r = options().rect;
    drag = {
      ...p,
      rect: r,
      corner:
        (Math.abs(p.x - r.x) < 30
          ? 'left'
          : Math.abs(p.x - r.x - r.w) < 30
            ? 'right'
            : '') +
        (Math.abs(p.y - r.y) < 30
          ? 'top'
          : Math.abs(p.y - r.y - r.h) < 30
            ? 'bottom'
            : ''),
    };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const p = point(event);
    if (mode === 'blur-face' && val('blur-mode') === 'brush') {
      regions.push({
        x: p.x,
        y: p.y,
        w: num('blur-size', 24) * 3,
        h: num('blur-size', 24) * 3,
        brush: true,
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
            images[0].naturalWidth - drag.rect.w,
            drag.rect.x + p.x - drag.x,
          ),
        ),
        y: Math.max(
          0,
          Math.min(
            images[0].naturalHeight - drag.rect.h,
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
        const limit = p.y < fixedY ? fixedY : images[0].naturalHeight - fixedY;
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
      regions.push(options().rect);
    drag = undefined;
    render();
  });
  canvas.addEventListener('pointercancel', () => {
    drag = undefined;
  });
  get('edit-export').addEventListener('click', async () => {
    if (busy || !images.length) return;
    busy = true;
    get<HTMLButtonElement>('edit-export').disabled = true;
    get<HTMLButtonElement>('edit-reset').disabled = true;
    output.clear();
    try {
      status('Exporting locally...');
      await pausePaint();
      const opts = options(),
        results = [];
      if (opts.mime === 'image/gif')
        results.push({
          name: 'kittysuite-animation.gif',
          blob: await animatedGIF(
            images,
            num('frame-delay'),
            checked('gif-loop'),
          ),
        });
      else
        for (let i = 0; i < images.length; i++) {
          const img = images[i];
          const filter = val('orientation-filter', 'all');
          const applies =
            filter === 'all' ||
            (filter === 'landscape'
              ? img.naturalWidth > img.naturalHeight
              : img.naturalHeight > img.naturalWidth);
          const c = editImage(img, {
            ...opts,
            angle: applies ? opts.angle : 0,
          });
          try {
            results.push({
              name:
                files[i].name.replace(/\.[^.]+$/, '') +
                '-kittysuite.' +
                (opts.mime === 'image/jpeg' ? 'jpg' : opts.mime.split('/')[1]),
              blob: await encode(c, opts.mime, 0.9),
            });
          } finally {
            c.width = c.height = 0;
          }
          await pausePaint();
        }
      for (const item of results) output.add(item.blob, item.name);
      if (results.length > 1)
        output.add(await zipOutputs(results), 'kittysuite-images.zip');
      status(
        `Exported ${results.length} file(s), ${size(results.reduce((n, r) => n + r.blob.size, 0))}. Original metadata removed.`,
      );
    } catch (e) {
      status(friendlyError(e));
    } finally {
      busy = false;
      get<HTMLButtonElement>('edit-export').disabled = false;
      get<HTMLButtonElement>('edit-reset').disabled = false;
    }
  });
  function reset() {
    images.forEach((img) => img.removeAttribute('src'));
    images = [];
    files = [];
    overlay?.removeAttribute('src');
    overlay = undefined;
    regions = [];
    output.clear();
    canvas.width = canvas.height = 0;
    if (previewCanvas) previewCanvas.width = previewCanvas.height = 0;
    get('local-editor').hidden = true;
    get<HTMLInputElement>('local-files').value = '';
    status('Choose another image.');
  }
  get('edit-reset').addEventListener('click', reset);
  window.addEventListener('pagehide', reset);
}
