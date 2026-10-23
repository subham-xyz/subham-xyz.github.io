import { checkDimensions, encode } from './image-core.mjs';
export function cropBounds(rect, width, height) {
  const { x, y, w, h } = rect;
  if (
    ![x, y, w, h].every(Number.isFinite) ||
    x < 0 ||
    y < 0 ||
    w < 1 ||
    h < 1 ||
    x + w > width ||
    y + h > height
  )
    throw new Error('Keep the crop inside the image with positive dimensions.');
  return {
    x: Math.round(x),
    y: Math.round(y),
    w: Math.round(w),
    h: Math.round(h),
  };
}
export function rotationSize(w, h, degrees) {
  const radians = (degrees * Math.PI) / 180;
  return {
    width: Math.max(
      1,
      Math.round(
        Math.abs(w * Math.cos(radians)) + Math.abs(h * Math.sin(radians)),
      ),
    ),
    height: Math.max(
      1,
      Math.round(
        Math.abs(w * Math.sin(radians)) + Math.abs(h * Math.cos(radians)),
      ),
    ),
  };
}
export async function decodeImage(file) {
  if (/\.heic$|\.heif$/i.test(file.name))
    throw new Error('Export HEIC/HEIF as JPG or PNG in your photo app first.');
  let blob = file;
  if (/\.svg$/i.test(file.name)) {
    const parsed = new DOMParser().parseFromString(
      await file.text(),
      'image/svg+xml',
    );
    if (
      parsed.querySelector('parsererror') ||
      parsed.documentElement.localName !== 'svg'
    )
      throw new Error('This SVG could not be read.');
    const allowed = new Set([
      'svg',
      'g',
      'path',
      'rect',
      'circle',
      'ellipse',
      'line',
      'polyline',
      'polygon',
      'text',
      'tspan',
      'defs',
      'linearGradient',
      'radialGradient',
      'stop',
      'clipPath',
    ]);
    for (const el of [...parsed.querySelectorAll('*')]) {
      if (!allowed.has(el.localName)) {
        el.remove();
        continue;
      }
      for (const attr of [...el.attributes])
        if (
          /^on/i.test(attr.name) ||
          /href|style/i.test(attr.name) ||
          /url\s*\(|javascript:|data:|https?:/i.test(attr.value)
        )
          el.removeAttribute(attr.name);
    }
    blob = new Blob([new XMLSerializer().serializeToString(parsed)], {
      type: 'image/svg+xml',
    });
  }
  if (/\.tiff?$/i.test(file.name)) {
    const { default: UTIF } = await import('utif');
    const bytes = await file.arrayBuffer(),
      pages = UTIF.decode(bytes);
    if (!pages.length) throw new Error('This TIFF has no readable image.');
    const page = pages[0];
    checkDimensions(Number(page.t256?.[0]), Number(page.t257?.[0]));
    UTIF.decodeImage(bytes, page);
    const c = document.createElement('canvas');
    c.width = page.width;
    c.height = page.height;
    c.getContext('2d').putImageData(
      new ImageData(
        new Uint8ClampedArray(UTIF.toRGBA8(page)),
        page.width,
        page.height,
      ),
      0,
      0,
    );
    blob = await encode(c, 'image/png', 1);
    c.width = c.height = 0;
  }
  const url = URL.createObjectURL(blob),
    img = new Image();
  try {
    img.src = url;
    await img.decode();
    checkDimensions(img.naturalWidth, img.naturalHeight);
    return img;
  } catch {
    img.removeAttribute('src');
    throw new Error(
      'This image cannot be decoded safely. Try JPG, PNG, WebP or a simpler SVG/TIFF.',
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function editImage(source, options) {
  const sw = source.naturalWidth,
    sh = source.naturalHeight,
    mode = options.mode;
  const rect =
    mode === 'crop-image'
      ? cropBounds(options.rect, sw, sh)
      : { x: 0, y: 0, w: sw, h: sh };
  const rotation = mode === 'rotate-image' ? options.angle : 0;
  const dimensions = rotationSize(rect.w, rect.h, rotation);
  checkDimensions(dimensions.width, dimensions.height);
  const canvas = document.createElement('canvas');
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = options.background || '#ffffff';
  if (options.mime === 'image/jpeg')
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  if (mode === 'photo-editor') ctx.filter = options.filter || 'none';
  ctx.drawImage(
    source,
    rect.x,
    rect.y,
    rect.w,
    rect.h,
    -rect.w / 2,
    -rect.h / 2,
    rect.w,
    rect.h,
  );
  ctx.restore();
  if (mode === 'blur-face') {
    for (const region of options.regions || []) {
      ctx.save();
      ctx.beginPath();
      if (region.brush)
        ctx.arc(region.x, region.y, region.w / 2, 0, Math.PI * 2);
      else ctx.rect(region.x, region.y, region.w, region.h);
      ctx.clip();
      ctx.filter = `blur(${options.blur || 18}px)`;
      ctx.drawImage(source, 0, 0);
      ctx.restore();
    }
  }
  if (['photo-editor', 'meme-generator', 'watermark-image'].includes(mode)) {
    const fontSize = options.fontSize || 40;
    ctx.font = `bold ${fontSize}px ${options.font || 'sans-serif'}`;
    ctx.textAlign = options.align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = options.color || '#ffffff';
    ctx.strokeStyle = options.outlineColor || '#000000';
    ctx.lineWidth = Math.max(1, fontSize / 14);
    ctx.lineJoin = 'round';
    function text(value, x, y) {
      if (options.outline) ctx.strokeText(value, x, y, canvas.width * 0.95);
      ctx.fillText(value, x, y, canvas.width * 0.95);
    }
    if (mode === 'meme-generator') {
      const x =
        options.align === 'left'
          ? fontSize / 2
          : options.align === 'right'
            ? canvas.width - fontSize / 2
            : canvas.width / 2;
      text(options.text || '', x, fontSize);
      text(options.bottom || '', x, canvas.height - fontSize);
    } else {
      ctx.save();
      ctx.globalAlpha = options.opacity ?? 1;
      const stamp = (x, y) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(((options.stampRotation || 0) * Math.PI) / 180);
        if (options.overlay) {
          const w = canvas.width * (options.scale || 0.3);
          const h =
            (w * options.overlay.naturalHeight) / options.overlay.naturalWidth;
          ctx.drawImage(options.overlay, -w / 2, -h / 2, w, h);
        } else text(options.text || '', 0, 0);
        ctx.restore();
      };
      if (options.tile) {
        for (let y = fontSize; y < canvas.height; y += fontSize * 4)
          for (
            let x = fontSize;
            x < canvas.width;
            x += Math.max(fontSize * 6, canvas.width / 3)
          )
            stamp(x, y);
      } else
        stamp(
          canvas.width * (options.x ?? 0.5),
          canvas.height * (options.y ?? 0.5),
        );
      ctx.restore();
    }
    if (mode === 'photo-editor') {
      const frame = options.frame || 0;
      ctx.lineWidth = frame * 2;
      ctx.strokeStyle = options.frameColor || options.color || '#ffffff';
      if (frame) ctx.strokeRect(0, 0, canvas.width, canvas.height);
      if (options.sticker) {
        const x = canvas.width * 0.82,
          y = canvas.height * 0.18,
          r = Math.min(canvas.width, canvas.height) * 0.07;
        ctx.fillStyle = '#a4d4c5';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x - r, y);
        ctx.lineTo(x - r, y - r * 1.6);
        ctx.lineTo(x, y - r * 0.6);
        ctx.lineTo(x + r, y - r * 1.6);
        ctx.lineTo(x + r, y);
        ctx.fill();
        ctx.fillStyle = '#18292d';
        for (const d of [-0.35, 0.35]) {
          ctx.beginPath();
          ctx.arc(x + d * r, y, r * 0.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  return canvas;
}
export async function animatedGIF(images, delay, loop) {
  if (!Number.isFinite(delay) || delay < 20 || delay > 10000)
    throw new Error('Choose a frame delay from 20 to 10,000 milliseconds.');
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  const gif = GIFEncoder();
  const ratio = Math.min(
      1,
      800 / images[0].naturalWidth,
      800 / images[0].naturalHeight,
    ),
    w = Math.round(images[0].naturalWidth * ratio),
    h = Math.round(images[0].naturalHeight * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  try {
    for (const image of images) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      const s = Math.min(w / image.naturalWidth, h / image.naturalHeight);
      ctx.drawImage(
        image,
        (w - image.naturalWidth * s) / 2,
        (h - image.naturalHeight * s) / 2,
        image.naturalWidth * s,
        image.naturalHeight * s,
      );
      const rgba = ctx.getImageData(0, 0, w, h).data,
        palette = quantize(rgba, 256),
        indexed = applyPalette(rgba, palette);
      gif.writeFrame(indexed, w, h, { palette, delay, repeat: loop ? 0 : -1 });
      await new Promise((r) => setTimeout(r, 0));
    }
    gif.finish();
    return new Blob([gif.bytes()], { type: 'image/gif' });
  } finally {
    canvas.width = canvas.height = 0;
  }
}
