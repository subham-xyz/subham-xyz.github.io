import { checkDimensions, encode } from './image-core.mjs';
const insideImage = ({ x, y, w, h }, width, height) =>
  [x, y, w, h].every(Number.isFinite) &&
  x >= 0 &&
  y >= 0 &&
  w >= 1 &&
  h >= 1 &&
  x + w <= width &&
  y + h <= height;
export function cropBounds(rect, width, height) {
  if (!insideImage(rect, width, height))
    throw new Error('Keep the crop inside the image with positive dimensions.');
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    w: Math.round(rect.w),
    h: Math.round(rect.h),
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
const SVG_ALLOWED = new Set([
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
const unsafeAttribute = (attr) =>
  /^on/i.test(attr.name) ||
  /href|style/i.test(attr.name) ||
  /url\s*\(|javascript:|data:|https?:/i.test(attr.value);
// Rebuilds an SVG from a strict set of drawing elements, without scripts or links.
async function sanitizeSVG(file) {
  const parsed = new DOMParser().parseFromString(
    await file.text(),
    'image/svg+xml',
  );
  if (
    parsed.querySelector('parsererror') ||
    parsed.documentElement.localName !== 'svg'
  )
    throw new Error('This SVG could not be read.');
  for (const el of [...parsed.querySelectorAll('*')]) {
    if (!SVG_ALLOWED.has(el.localName)) el.remove();
    else
      for (const attr of [...el.attributes])
        if (unsafeAttribute(attr)) el.removeAttribute(attr.name);
  }
  return new Blob([new XMLSerializer().serializeToString(parsed)], {
    type: 'image/svg+xml',
  });
}
// First page of a TIFF as a PNG blob.
async function tiffToPNG(file) {
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
  const blob = await encode(c, 'image/png', 1);
  c.width = c.height = 0;
  return blob;
}
async function readableBlob(file) {
  if (/\.heic$|\.heif$/i.test(file.name))
    throw new Error('Export HEIC/HEIF as JPG or PNG in your photo app first.');
  if (/\.svg$/i.test(file.name)) return sanitizeSVG(file);
  if (/\.tiff?$/i.test(file.name)) return tiffToPNG(file);
  return file;
}
export async function decodeImage(file) {
  const blob = await readableBlob(file);
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

const TEXT_MODES = ['photo-editor', 'meme-generator', 'watermark-image'];

function blurRegions(ctx, source, options) {
  for (const region of options.regions || []) {
    ctx.save();
    ctx.beginPath();
    if (region.brush) ctx.arc(region.x, region.y, region.w / 2, 0, Math.PI * 2);
    else ctx.rect(region.x, region.y, region.w, region.h);
    ctx.clip();
    ctx.filter = `blur(${options.blur || 18}px)`;
    ctx.drawImage(source, 0, 0);
    ctx.restore();
  }
}
function setTextStyle(ctx, options, fontSize) {
  ctx.font = `bold ${fontSize}px ${options.font || 'sans-serif'}`;
  ctx.textAlign = options.align || 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = options.color || '#ffffff';
  ctx.strokeStyle = options.outlineColor || '#000000';
  ctx.lineWidth = Math.max(1, fontSize / 14);
  ctx.lineJoin = 'round';
}
// Draws one line of caption text, outlined when requested.
function textWriter(ctx, options) {
  const maxWidth = ctx.canvas.width * 0.95;
  return (value, x, y) => {
    if (options.outline) ctx.strokeText(value, x, y, maxWidth);
    ctx.fillText(value, x, y, maxWidth);
  };
}
function drawMeme(ctx, options, fontSize, text) {
  const { width, height } = ctx.canvas;
  const xs = { left: fontSize / 2, right: width - fontSize / 2 };
  const x = xs[options.align] ?? width / 2;
  text(options.text || '', x, fontSize);
  text(options.bottom || '', x, height - fontSize);
}
function drawStamps(ctx, options, fontSize, text) {
  const { width, height } = ctx.canvas;
  const stamp = (x, y) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(((options.stampRotation || 0) * Math.PI) / 180);
    if (options.overlay) {
      const w = width * (options.scale || 0.3);
      const h =
        (w * options.overlay.naturalHeight) / options.overlay.naturalWidth;
      ctx.drawImage(options.overlay, -w / 2, -h / 2, w, h);
    } else text(options.text || '', 0, 0);
    ctx.restore();
  };
  ctx.save();
  ctx.globalAlpha = options.opacity ?? 1;
  if (!options.tile)
    stamp(width * (options.x ?? 0.5), height * (options.y ?? 0.5));
  else
    for (let y = fontSize; y < height; y += fontSize * 4)
      for (let x = fontSize; x < width; x += Math.max(fontSize * 6, width / 3))
        stamp(x, y);
  ctx.restore();
}
// The original geometric Loki sticker in the top-right corner. Its size follows
// the image's shorter side and it sits fully inside the picture (and any frame),
// ears included, whatever the aspect ratio.
export function stickerBox(width, height, frame = 0) {
  const short = Math.min(width, height);
  const r = short * 0.07;
  const margin = Math.min(frame, short * 0.25) + short * 0.04;
  return { x: width - margin - r, y: margin + r * 1.6, r };
}
function drawSticker(ctx, frame) {
  const { width, height } = ctx.canvas;
  const { x, y, r } = stickerBox(width, height, frame);
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
function drawFrameAndSticker(ctx, options) {
  const frame = options.frame || 0;
  ctx.lineWidth = frame * 2;
  ctx.strokeStyle = options.frameColor || options.color || '#ffffff';
  if (frame) ctx.strokeRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (options.sticker) drawSticker(ctx, frame);
}
function drawText(ctx, options) {
  const fontSize = options.fontSize || 40;
  setTextStyle(ctx, options, fontSize);
  const text = textWriter(ctx, options);
  if (options.mode === 'meme-generator') drawMeme(ctx, options, fontSize, text);
  else drawStamps(ctx, options, fontSize, text);
  if (options.mode === 'photo-editor') drawFrameAndSticker(ctx, options);
}
function sourceRect(source, options) {
  const sw = source.naturalWidth,
    sh = source.naturalHeight;
  return options.mode === 'crop-image'
    ? cropBounds(options.rect, sw, sh)
    : { x: 0, y: 0, w: sw, h: sh };
}
function drawBase(ctx, source, rect, rotation, options) {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = options.background || '#ffffff';
  if (options.mime === 'image/jpeg') ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  // Flips mirror the source; the rotation is then applied to the mirrored image.
  if (options.mode === 'rotate-image')
    ctx.scale(options.flipH ? -1 : 1, options.flipV ? -1 : 1);
  if (options.mode === 'photo-editor') ctx.filter = options.filter || 'none';
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
}
export function editImage(source, options) {
  const rect = sourceRect(source, options);
  const rotation = options.mode === 'rotate-image' ? options.angle : 0;
  const dimensions = rotationSize(rect.w, rect.h, rotation);
  checkDimensions(dimensions.width, dimensions.height);
  const canvas = document.createElement('canvas');
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const ctx = canvas.getContext('2d');
  drawBase(ctx, source, rect, rotation, options);
  if (options.mode === 'blur-face') blurRegions(ctx, source, options);
  if (TEXT_MODES.includes(options.mode)) drawText(ctx, options);
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
