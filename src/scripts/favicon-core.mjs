// Favicon Generator: one square master from the user's image, then the standard
// set (PNG sizes, a multi-size favicon.ico, a web manifest and the HTML tags).
// Canvas only; .ico files simply embed PNGs, so no extra library is needed.
import { encode } from './image-core.mjs';

export const MASTER = 512;
/** @type {[string, number][]} */
export const PNG_SIZES = [
  ['favicon-16x16.png', 16],
  ['favicon-32x32.png', 32],
  ['favicon-48x48.png', 48],
  ['apple-touch-icon.png', 180],
  ['android-chrome-192x192.png', 192],
  ['android-chrome-512x512.png', 512],
];
const ICO_SIZES = [16, 32, 48];

/**
 * Square 512 px master. fit 'crop' fills the square from the centre; 'pad' keeps
 * the whole image. padding is a fraction (0-0.3) of empty space on every side.
 * background null keeps transparency (Apple's icon always gets one, see below).
 * @param {any} source image or canvas
 * @param {{ fit?: string, padding?: number, background?: string | null }} [options]
 */
export function faviconMaster(
  source,
  { fit = 'crop', padding = 0, background = null } = {},
) {
  const sw = source.naturalWidth || source.width,
    sh = source.naturalHeight || source.height;
  const c = document.createElement('canvas');
  c.width = c.height = MASTER;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, MASTER, MASTER);
  }
  const inner = MASTER * (1 - 2 * Math.min(0.3, Math.max(0, padding)));
  const offset = (MASTER - inner) / 2;
  if (fit === 'crop') {
    const side = Math.min(sw, sh);
    ctx.drawImage(
      source,
      (sw - side) / 2,
      (sh - side) / 2,
      side,
      side,
      offset,
      offset,
      inner,
      inner,
    );
  } else {
    const s = inner / Math.max(sw, sh);
    const w = sw * s,
      h = sh * s;
    ctx.drawImage(source, (MASTER - w) / 2, (MASTER - h) / 2, w, h);
  }
  return c;
}

// Halving steps keep small icons crisp instead of aliased.
function scaled(master, size, background) {
  let current = master;
  while (current.width / 2 >= size * 1.5) {
    const half = document.createElement('canvas');
    half.width = half.height = Math.round(current.width / 2);
    const hctx = half.getContext('2d');
    hctx.imageSmoothingQuality = 'high';
    hctx.drawImage(current, 0, 0, half.width, half.height);
    if (current !== master) current.width = current.height = 0;
    current = half;
  }
  const out = document.createElement('canvas');
  out.width = out.height = size;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size, size);
  }
  ctx.drawImage(current, 0, 0, size, size);
  if (current !== master) current.width = current.height = 0;
  return out;
}

async function pngOf(master, size, background) {
  const c = scaled(master, size, background);
  try {
    return await encode(c, 'image/png', 1);
  } finally {
    c.width = c.height = 0;
  }
}

/** ICO container holding PNG images (supported by every current browser and Windows). */
export async function buildIco(pngs) {
  const header = 6 + 16 * pngs.length;
  const buffers = await Promise.all(pngs.map(({ blob }) => blob.arrayBuffer()));
  const out = new Uint8Array(
    header + buffers.reduce((n, b) => n + b.byteLength, 0),
  );
  const view = new DataView(out.buffer);
  view.setUint16(2, 1, true);
  view.setUint16(4, pngs.length, true);
  let offset = header;
  pngs.forEach(({ size }, i) => {
    const at = 6 + i * 16;
    out[at] = size >= 256 ? 0 : size;
    out[at + 1] = size >= 256 ? 0 : size;
    view.setUint16(at + 4, 1, true); // colour planes
    view.setUint16(at + 6, 32, true); // bits per pixel
    view.setUint32(at + 8, buffers[i].byteLength, true);
    view.setUint32(at + 12, offset, true);
    out.set(new Uint8Array(buffers[i]), offset);
    offset += buffers[i].byteLength;
  });
  return new Blob([out], { type: 'image/x-icon' });
}

export const htmlSnippet = () =>
  [
    '<link rel="icon" href="/favicon.ico" sizes="48x48">',
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
    '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">',
  ].join('\n');

export const manifest = (name = 'My site') =>
  JSON.stringify(
    {
      name,
      short_name: name,
      icons: [
        {
          src: '/android-chrome-192x192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: '/android-chrome-512x512.png',
          sizes: '512x512',
          type: 'image/png',
        },
      ],
      display: 'browser',
    },
    null,
    2,
  );

/**
 * Every file of the set, ready to download or ZIP.
 * @param {HTMLCanvasElement} master
 * @param {{ background?: string | null, appleBackground?: string, name?: string }} [options]
 * @returns {Promise<{ name: string, blob: Blob }[]>}
 */
export async function faviconSet(
  master,
  { background = null, appleBackground = '#ffffff', name } = {},
) {
  const files = [];
  const icoParts = [];
  for (const [file, size] of PNG_SIZES) {
    // iOS shows transparent areas of a home-screen icon as black, so it gets a background.
    const blob = await pngOf(
      master,
      size,
      size === 180 ? background || appleBackground : background,
    );
    files.push({ name: file, blob });
    if (ICO_SIZES.includes(size)) icoParts.push({ size, blob });
  }
  files.unshift({ name: 'favicon.ico', blob: await buildIco(icoParts) });
  files.push({
    name: 'site.webmanifest',
    blob: new Blob([manifest(name)], { type: 'application/manifest+json' }),
  });
  files.push({
    name: 'favicon-html.txt',
    blob: new Blob([htmlSnippet() + '\n'], { type: 'text/plain' }),
  });
  return files;
}
