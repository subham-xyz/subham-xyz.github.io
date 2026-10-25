export const size = (bytes) =>
  bytes >= 1048576
    ? `${(bytes / 1048576).toFixed(2)} MB`
    : `${(bytes / 1024).toFixed(1)} KB`;
export const normalizeFilename = (value) =>
  value
    .trim()
    .replace(/\.(jpe?g|png|webp|avif|bmp|gif)$/i, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/[. ]+$/g, '')
    .slice(0, 100) || 'image';
export function checkFile(file, font = false) {
  const allowed = font
    ? /\.(jpe?g|png|webp)$/i
    : /\.(jpe?g|png|webp|bmp|gif|avif)$/i;
  if (!allowed.test(file.name))
    throw new Error(
      'This format is not supported. Export HEIC/HEIF as JPG or PNG in your photo app, then choose that file here.',
    );
  if (!file.size || file.size > 20 * 1048576)
    throw new Error('Choose a non-empty image no larger than 20 MB.');
}
const pixelSide = (n) => Number.isInteger(n) && n >= 1 && n <= 16384;
export function checkDimensions(width, height) {
  if (!pixelSide(width) || !pixelSide(height) || width * height > 16000000)
    throw new Error(
      'Use positive whole pixel dimensions up to 16 megapixels and 16,384 pixels per side.',
    );
}
export function encode(canvas, mime, quality) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.type !== mime)
          reject(
            new Error(
              'Your browser cannot encode this format. Choose another output format.',
            ),
          );
        else resolve(blob);
      },
      mime,
      quality,
    ),
  );
}
export async function capabilities() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const supported = [];
  for (const mime of ['image/png', 'image/jpeg', 'image/webp', 'image/avif']) {
    try {
      await encode(canvas, mime, 0.8);
      supported.push(mime);
    } catch {}
  }
  canvas.width = canvas.height = 0;
  return supported;
}
export function draw(source, width, height, fit, background, mime) {
  checkDimensions(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx)
    throw new Error(
      'Canvas unavailable. Try a smaller image or another browser.',
    );
  if (mime === 'image/jpeg' || background !== 'transparent') {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }
  const ratio =
    fit === 'crop'
      ? Math.max(width / source.naturalWidth, height / source.naturalHeight)
      : Math.min(width / source.naturalWidth, height / source.naturalHeight);
  const w = source.naturalWidth * ratio,
    h = source.naturalHeight * ratio;
  ctx.drawImage(source, (width - w) / 2, (height - h) / 2, w, h);
  return canvas;
}
export function validate(candidate, rules) {
  const { blob, width, height } = candidate;
  const checks = [
    [
      rules.min && blob.size < rules.min,
      `Below minimum size (${size(rules.min)}).`,
    ],
    [
      rules.max && blob.size > rules.max,
      `Target unreachable within these settings: exceeds ${size(rules.max)}.`,
    ],
    [rules.width && width !== rules.width, `Width must be ${rules.width} px.`],
    [
      rules.height && height !== rules.height,
      `Height must be ${rules.height} px.`,
    ],
    [
      rules.mime && blob.type !== rules.mime,
      'Output format does not meet the requirement.',
    ],
  ];
  return checks.filter(([failed]) => failed).map(([, message]) => message);
}
// Verify decoded dimensions from the encoded bytes, not just the requested canvas.
export async function inspectOutput(candidate) {
  const bitmap = await createImageBitmap(candidate.blob);
  try {
    return { ...candidate, width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}
// Bytes outside the [min, max] window (0 means the size fits).
const sizeGap = (bytes, min, max) =>
  bytes < min ? min - bytes : max && bytes > max ? bytes - max : 0;
// Try the requested quality, then best, then lowest, then bisect.
const qualityFor = (i, requested, lowest, low, high) =>
  [requested, 1, lowest][i] ?? (low + high) / 2;
// Closer to the target wins; ties prefer more pixels, then quality nearest the request.
function better(candidate, gap, best, distance, requested) {
  if (gap !== distance) return gap < distance;
  if (!best) return true;
  const area = candidate.width * candidate.height,
    bestArea = best.width * best.height;
  if (area !== bestArea) return area > bestArea;
  return (
    Math.abs(candidate.quality - requested) < Math.abs(best.quality - requested)
  );
}
// Bounded search: prefer usable quality, then reduce dimensions only with consent.
export async function searchOutput(render, options) {
  const { width, height, quality, mime, min, max, downscale, fixed } = {
    min: 0,
    max: 0,
    downscale: false,
    fixed: false,
    ...options,
  };
  let best,
    distance = Infinity;
  const shrinking = downscale && !fixed && max;
  const floor = shrinking ? Math.min(0.35, quality) : 0.1;
  const attempts = mime === 'image/png' || (!min && !max) ? 1 : 12;
  function keep(candidate, gap) {
    if (!better(candidate, gap, best, distance, quality)) return;
    best = candidate;
    distance = gap;
  }
  async function at(scale, minimumQuality = floor) {
    const w = Math.max(1, Math.round(width * scale)),
      h = Math.max(1, Math.round(height * scale));
    let low = minimumQuality,
      high = 1,
      feasible;
    for (let i = 0; i < attempts; i++) {
      const q = qualityFor(i, quality, minimumQuality, low, high);
      const blob = await render(w, h, q);
      const candidate = { blob, width: w, height: h, quality: q };
      const gap = sizeGap(blob.size, min, max);
      keep(candidate, gap);
      if (!gap) feasible = candidate;
      if (!gap && i === 0) break;
      if (i < 2) continue;
      if (max && blob.size > max) high = q;
      else low = q;
    }
    return feasible;
  }
  // Recover dimensions between coarse steps without unbounded encoding work.
  async function refine(low, high) {
    for (let i = 0; i < 5; i++) {
      const middle = (low + high) / 2;
      if (await at(middle)) low = middle;
      else high = middle;
    }
  }
  let previous = 1;
  for (let level = 0; level < (shrinking ? 13 : 1); level++) {
    const scale = 0.75 ** level;
    if (await at(scale)) {
      if (level) await refine(scale, previous);
      break;
    }
    previous = scale;
    // Downscaling cannot help reach an unmet minimum.
    if (best.blob.size < min) break;
  }
  if (!best)
    throw new Error(
      'No usable output could be encoded. Try different settings.',
    );
  return best;
}
