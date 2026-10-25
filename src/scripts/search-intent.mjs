// Turns a typed instruction ("compress 50kb to 20kb") into a tool and settings.
// Rule based, synchronous and dependency free: nothing leaves the browser.

/**
 * @typedef {'image-compressor' | 'image-resizer' | 'image-converter' | 'jpg-to-pdf' | 'merge-pdf' | 'compress-pdf' | 'crop-image' | 'rotate-image' | 'watermark-image' | 'remove-image-metadata' | 'image-size-checker' | 'pdf-to-jpg' | 'pdf-to-text' | 'split-pdf' | 'organize-pdf' | 'rotate-pdf' | 'crop-pdf' | 'watermark-pdf' | 'page-numbers' | 'favicon-generator'} IntentTool
 * @typedef {'jpg' | 'png' | 'webp' | 'avif'} ImageFormat
 * @typedef {{ targetSize?: number, unit?: 'KB' | 'MB', width?: number, height?: number, format?: ImageFormat }} IntentParams
 * @typedef {{ tool: IntentTool, label: string, confidence: number, params: IntentParams }} SearchIntent
 */

/** Confidence needed before Enter opens the interpreted tool directly. */
export const STRONG_INTENT = 0.8;
export const MAX_SIDE = 16384;
const MAX_KB = 20 * 1024;

/** @type {Record<IntentTool, { label: string, path: string, params: (keyof IntentParams)[] }>} */
export const intentTools = {
  'image-compressor': {
    label: 'Compress Image',
    path: '/compress-image/',
    params: ['targetSize', 'unit', 'format'],
  },
  'image-resizer': {
    label: 'Resize Image',
    path: '/resize-image/',
    params: ['width', 'height', 'targetSize', 'unit'],
  },
  'image-converter': {
    label: 'Image Converter',
    path: '/convert-image/',
    params: ['format'],
  },
  'jpg-to-pdf': { label: 'JPG to PDF', path: '/jpg-to-pdf/', params: [] },
  'merge-pdf': { label: 'Merge PDF', path: '/merge-pdf/', params: [] },
  // The PDF compressor offers levels, not a size target, so no settings are passed.
  'compress-pdf': { label: 'Compress PDF', path: '/compress-pdf/', params: [] },
  // Single-action tools: the command only picks the tool, nothing is prefilled.
  'crop-image': { label: 'Crop Image', path: '/crop-image/', params: [] },
  'rotate-image': { label: 'Rotate Image', path: '/rotate-image/', params: [] },
  'watermark-image': {
    label: 'Watermark Image',
    path: '/watermark-image/',
    params: [],
  },
  'remove-image-metadata': {
    label: 'Remove Image Metadata',
    path: '/remove-image-metadata/',
    params: [],
  },
  'image-size-checker': {
    label: 'Image Size Checker',
    path: '/image-size-checker/',
    params: [],
  },
  'pdf-to-jpg': { label: 'PDF to JPG', path: '/pdf-to-jpg/', params: [] },
  'pdf-to-text': { label: 'PDF to Text', path: '/pdf-to-text/', params: [] },
  'split-pdf': { label: 'Split PDF', path: '/split-pdf/', params: [] },
  'organize-pdf': { label: 'Organize PDF', path: '/organize-pdf/', params: [] },
  'rotate-pdf': { label: 'Rotate PDF', path: '/rotate-pdf/', params: [] },
  'crop-pdf': { label: 'Crop PDF', path: '/crop-pdf/', params: [] },
  'watermark-pdf': {
    label: 'Watermark PDF',
    path: '/watermark-pdf/',
    params: [],
  },
  'page-numbers': { label: 'Page Numbers', path: '/page-numbers/', params: [] },
  'favicon-generator': {
    label: 'Favicon Generator',
    path: '/favicon-generator/',
    params: [],
  },
};

const IMAGE_FORMATS = ['jpg', 'png', 'webp', 'avif'];
const COMPRESS =
  /\b(compress\w*|reduce|shrink|smaller|minimi[sz]e|optimi[sz]e|lighter|decrease|lower)\b/;
const RESIZE = /\b(resize\w*|rescale|scale|dimensions?|resolution)\b/;
const CONVERT = /\b(convert\w*|change|turn|save|export|transform)\b/;
const MERGE = /\b(merge|combine|join|append|stitch)\b/;
const PDF = /\bpdfs?\b/;
const IMAGE =
  /\b(image|images|img|imgs|photo|photos|picture|pictures|pic|pics|selfie|signature|screenshot|scans?|jpe?gs?|pngs?|webps?|avifs?)\b/;
const MAKE = /\b(make|get|set|need|want)\b/;
const LIMIT =
  /\b(under|below|beneath|less than|smaller than|lower than|max(?:imum)?|within|at most|up ?to)\b|[<≤]/;
const TARGET_WORD =
  /\b(?:to|into|under|below|beneath|less than|smaller than|lower than|lesser than|max(?:imum)?|within|up ?to|at most|around|about)\b|[<≤~]/g;
const SIZE =
  /(-?)(\d+(?:\.\d+)?)\s*(kb|kib|kilobytes?|mb|mib|megabytes?)(?![a-z])/g;
const DIMS =
  /(-?)\b(\d+)\s*(?:x|by|\*)\s*(-?)(\d+)\s*(?:px|pixels?)?(?![a-z\d])/;
const FORMAT_AFTER =
  /\b(?:to|into|as|in)\s+(?:an?\s+)?(jpe?g|png|webp|avif|pdf)s?\b/;
const FORMAT_ANY = /\b(jpe?g|png|webp|avif|pdf)s?\b/g;

/** @param {unknown} query */
export function normalizeQuery(query) {
  return String(query ?? '')
    .toLowerCase()
    .slice(0, 160)
    .replace(/[×✕✖]/g, ' x ')
    .replace(/→|->|=>/g, ' to ')
    .replace(/(\d),(?=\d{3}\b)/g, '$1')
    .replace(
      /\b(jpe?g|png|webp|avif)\s*2\s*(jpe?g|png|webp|avif|pdf)\b/g,
      '$1 to $2',
    )
    .replace(/["“”'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const roundSize = (/** @type {number} */ value) =>
  Math.round(value * 100) / 100;

/** A target size the compressor can work with, or null. */
export function validSize(
  /** @type {number} */ value,
  /** @type {string} */ unit,
) {
  if (!Number.isFinite(value) || value <= 0) return null;
  const kb = unit === 'MB' ? value * 1024 : value;
  if (kb < 1 || kb > MAX_KB) return null;
  return {
    targetSize: roundSize(value),
    unit: /** @type {'KB'|'MB'} */ (unit === 'MB' ? 'MB' : 'KB'),
  };
}

/** A usable pixel side, or null. */
export function validSide(/** @type {unknown} */ value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= MAX_SIDE ? n : null;
}

function sizesIn(/** @type {string} */ text) {
  return [...text.matchAll(SIZE)].map((m) => ({
    negative: m[1] === '-',
    value: Number(m[2]),
    unit: m[3].startsWith('m') ? 'MB' : 'KB',
    start: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length,
  }));
}

// "compress 50kb to 20kb": the size after "to/under/below" is the goal; the
// first one only describes the file, which the upload measures for real.
function targetSize(/** @type {string} */ text) {
  const sizes = sizesIn(text);
  if (!sizes.length) return { found: false, value: null };
  const words = [...text.matchAll(TARGET_WORD)].map((m) => m.index ?? 0);
  let previousEnd = 0;
  for (const size of sizes) {
    if (words.some((i) => i >= previousEnd && i < size.start))
      return { found: true, value: checkSize(size) };
    previousEnd = size.end;
  }
  // "compress 50kb to" while still typing: wait for the real target.
  if (words.some((i) => i >= previousEnd)) return { found: true, value: null };
  return { found: true, value: checkSize(sizes[sizes.length - 1]) };
}
const checkSize = (
  /** @type {{negative:boolean,value:number,unit:string}} */ s,
) => (s.negative ? null : validSize(s.value, s.unit));

const WIDTH =
  /\bwidth\s*(?:of|=|:|to)?\s*(\d+)|\b(\d+)\s*(?:px|pixels?)?\s*(?:wide|width)\b/;
const HEIGHT =
  /\bheight\s*(?:of|=|:|to)?\s*(\d+)|\b(\d+)\s*(?:px|pixels?)?\s*(?:tall|high|height)\b/;
const LONE_PX = /\b(\d+)\s*(?:px|pixels?)\b/g;
const BARE_PAIR = /\b(\d{2,5})\s+(\d{2,5})\b/;
const captured = (/** @type {RegExpMatchArray | null} */ m) =>
  m ? m[1] || m[2] : undefined;

/** @returns {{ found: boolean, width?: number, height?: number }} */
function dimensions(
  /** @type {string} */ text,
  /** @type {boolean} */ resizeVerb,
) {
  const pair = text.match(DIMS);
  if (pair)
    return pair[1] || pair[3] ? sides(NaN, NaN) : sides(pair[2], pair[4]);
  const width = captured(text.match(WIDTH));
  const height = captured(text.match(HEIGHT));
  if (width || height) return sides(width, height);
  // "resize to 512px" means the width; the height follows the proportions.
  const lonePx = [...text.matchAll(LONE_PX)];
  if (lonePx.length === 1) return sides(lonePx[0][1], undefined);
  const bare = resizeVerb ? text.match(BARE_PAIR) : null;
  return bare ? sides(bare[1], bare[2]) : { found: false };
}
function sides(/** @type {unknown} */ w, /** @type {unknown} */ h) {
  const width = w === undefined ? null : validSide(w);
  const height = h === undefined ? null : validSide(h);
  return {
    found: true,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
  };
}

/** Output format named after "to/into/as", e.g. "png to jpg". */
function outputFormat(
  /** @type {string} */ text,
  /** @type {boolean} */ convertVerb,
) {
  const after = text.match(FORMAT_AFTER);
  if (after) return normalizeFormat(after[1]);
  const all = [...text.matchAll(FORMAT_ANY)].map((m) => normalizeFormat(m[1]));
  return (convertVerb && all.length) || all.length > 1
    ? all[all.length - 1]
    : null;
}
const normalizeFormat = (/** @type {string} */ f) => (f === 'jpeg' ? 'jpg' : f);
const imageFormat = (/** @type {string|null} */ f) =>
  f && IMAGE_FORMATS.includes(f) ? /** @type {ImageFormat} */ (f) : undefined;

/** @returns {SearchIntent} */
function intent(
  /** @type {IntentTool} */ tool,
  /** @type {number} */ confidence,
  /** @type {IntentParams} */ params = {},
) {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null),
  );
  return { tool, label: intentTools[tool].label, confidence, params: clean };
}

// Clear one-verb actions ("crop photo", "rotate pdf", "remove exif"). Checked
// before the size/format rules, and only when no size or dimensions were typed.
const METADATA =
  /\b(exif|metadata|meta data|geotags?|gps)\b|\b(?:remove|strip|delete|hide|clear)\b.*\blocation\b/;
const CHECK_SIZE =
  /\bsize checker\b|\b(?:check|checker|what|whats|find|view|see|show|know|get)\b.*\b(?:image|photo|picture|pic|img)s?\b.*\b(?:size|dimensions?|resolution|details|info)\b|\b(?:check|checker|what|whats|find|view|see|show|know|get)\b.*\b(?:size|dimensions?|resolution)\b.*\b(?:image|photo|picture|pic|img)s?\b|^(?:image|photo|picture|img) (?:size|dimensions?|resolution|info|details)$/;
const PAGE_NUMBERS =
  /\bpage numbers?\b|\bnumber (?:the |my |all )?pages\b|\bpaginat/;
const REORDER =
  /\b(?:reorder|re-order|rearrange|re-arrange|organi[sz]e|sort)\b/;
const PDF_TO_IMAGE =
  /\bpdfs? (?:to|into|as) (?:an? )?(?:images?|pictures?|photos?|jpe?gs?|pngs?)\b/;
const PDF_TO_TEXT =
  /\bpdfs? (?:to|into) (?:text|txt|markdown|md)\b|\b(?:extract|copy|get) (?:the )?text\b/;
function actionIntent(
  /** @type {Record<string, any>} */ q,
  /** @type {boolean} */ pdf,
) {
  const t = q.text;
  if (q.target.found || q.dims.found) return null;
  if (PAGE_NUMBERS.test(t)) return intent('page-numbers', 0.95);
  if (/\bfav ?icons?\b|\bapple touch icon\b/.test(t))
    return intent('favicon-generator', 0.96);
  if (pdf) {
    if (PDF_TO_IMAGE.test(t)) return intent('pdf-to-jpg', 0.96);
    if (PDF_TO_TEXT.test(t)) return intent('pdf-to-text', 0.93);
    if (/\b(?:rotate|turn|flip)\b/.test(t)) return intent('rotate-pdf', 0.95);
    if (/\b(?:crop|trim)\b/.test(t)) return intent('crop-pdf', 0.95);
    if (/\bwatermark/.test(t)) return intent('watermark-pdf', 0.96);
    if (REORDER.test(t)) return intent('organize-pdf', 0.95);
    if (/\b(?:split|separate|divide)\b/.test(t))
      return intent('split-pdf', 0.95);
    return null;
  }
  if (/\b(?:reorder|rearrange|re-arrange) pages\b/.test(t))
    return intent('organize-pdf', 0.9);
  if (METADATA.test(t)) return intent('remove-image-metadata', 0.95);
  if (CHECK_SIZE.test(t)) return intent('image-size-checker', 0.92);
  if (/\bcrop\w*\b/.test(t)) return intent('crop-image', q.image ? 0.96 : 0.88);
  if (/\b(?:rotate\w*|flip\w*|mirror\w*)\b/.test(t))
    return intent('rotate-image', q.image ? 0.96 : 0.88);
  if (/\bwatermark/.test(t))
    return intent('watermark-image', q.image ? 0.96 : 0.88);
  return null;
}

function pdfIntent(/** @type {Record<string, any>} */ q) {
  if (MERGE.test(q.text)) return intent('merge-pdf', 0.98);
  const action = actionIntent(q, true);
  if (action) return action;
  if ((q.output === 'pdf' || /\bpdfs? (?:from|of) /.test(q.text)) && q.image)
    return intent('jpg-to-pdf', 0.97);
  if (q.compress || q.target.found)
    return intent(
      'compress-pdf',
      q.compress ? 0.97 : 0.9,
      q.target.value || {},
    );
  return null;
}

function resizeIntent(/** @type {Record<string, any>} */ q) {
  const { width, height } = q.dims;
  const confidence = q.resize ? 0.97 : q.image || q.make ? 0.9 : 0.75;
  return intent('image-resizer', confidence, {
    width,
    height,
    ...(q.target.value || {}),
  });
}

function compressConfidence(/** @type {Record<string, any>} */ q) {
  if (q.compress) {
    if (q.image || q.target.found) return 0.97;
    return q.words > 1 ? 0.7 : 0.85; // "compress something" stays a suggestion
  }
  if (q.image || q.make) return 0.9;
  return q.limit ? 0.8 : 0; // a bare "20kb" is too vague
}

function compressIntent(/** @type {Record<string, any>} */ q) {
  const confidence = compressConfidence(q);
  if (!confidence) return null;
  // "compress png as jpg" changes the format; "compress jpg to 100kb" does not.
  const after = q.text.match(FORMAT_AFTER);
  const format = imageFormat(after ? normalizeFormat(after[1]) : null);
  return intent('image-compressor', confidence, {
    ...(q.target.value || {}),
    format,
  });
}

/**
 * @param {unknown} query
 * @returns {SearchIntent | null}
 */
export function parseSearchIntent(query) {
  const text = normalizeQuery(query);
  if (text.length < 3 || !/[a-z]/.test(text)) return null;
  const q = readQuery(text);
  if (PDF.test(text)) return pdfIntent(q);
  const action = actionIntent(q, false);
  if (action) return action;
  if (q.resize || (q.dims.found && !(q.compress && q.target.found)))
    return resizeIntent(q);
  if (q.compress || q.target.found) return compressIntent(q);
  const format = imageFormat(q.output);
  if (format) return intent('image-converter', 0.97, { format });
  return q.convert && q.image ? intent('image-converter', 0.85) : null;
}

function readQuery(/** @type {string} */ text) {
  const convert = CONVERT.test(text);
  const resize = RESIZE.test(text);
  return {
    text,
    words: text.split(' ').length,
    convert,
    resize,
    compress: COMPRESS.test(text),
    make: MAKE.test(text),
    limit: LIMIT.test(text),
    image: IMAGE.test(text),
    output: outputFormat(text, convert),
    target: targetSize(text),
    dims: dimensions(text, resize),
  };
}

function sizePart(/** @type {IntentParams} */ p) {
  if (p.width && p.height) return `${p.width} × ${p.height} px`;
  if (p.width) return `Width: ${p.width} px`;
  return p.height ? `Height: ${p.height} px` : '';
}

/** Short human summary of what the tool will be set to, or '' when nothing is prefilled. */
export function describeIntent(
  /** @type {{ tool: IntentTool, params?: IntentParams }} */ value,
) {
  const p = supportedParams(value);
  const resizer = value.tool === 'image-resizer';
  const converter = value.tool === 'image-converter';
  const parts = [
    sizePart(p),
    p.targetSize
      ? `${resizer ? 'Max' : 'Target:'} ${p.targetSize} ${p.unit}`
      : '',
    p.format
      ? `${converter ? 'Output:' : 'Save as'} ${p.format.toUpperCase()}`
      : '',
  ].filter(Boolean);
  if (
    !parts.length &&
    value.tool === 'compress-pdf' &&
    value.params?.targetSize
  )
    return 'Choose a compression level';
  return parts.join(' · ');
}

/** Only the settings the destination tool can actually receive. */
export function supportedParams(
  /** @type {{ tool: IntentTool, params?: IntentParams }} */ value,
) {
  /** @type {IntentParams} */
  const out = {};
  const params = value.params || {};
  for (const key of intentTools[value.tool]?.params || []) {
    if (params[key] !== undefined) Object.assign(out, { [key]: params[key] });
  }
  if (!out.targetSize) delete out.unit;
  return out;
}

/** "?targetSize=20&unit=KB" (or '' when there is nothing to prefill). */
export function intentQuery(
  /** @type {{ tool: IntentTool, params?: IntentParams }} */ value,
) {
  const search = new URLSearchParams();
  for (const [key, val] of Object.entries(supportedParams(value)))
    search.set(key, String(val));
  const text = search.toString();
  return text ? `?${text}` : '';
}

/** Canonical tool page plus prefill state; `base` is the (localized) tool path. */
export function buildIntentRoute(
  /** @type {SearchIntent} */ value,
  base = intentTools[value.tool].path,
) {
  return base.split(/[?#]/)[0] + intentQuery(value);
}

/**
 * Read and validate prefill settings on a tool page. Bad values are dropped.
 * @param {string} search
 * @param {IntentTool} tool
 * @returns {IntentParams}
 */
export function readToolParams(search, tool) {
  const query = new URLSearchParams(search);
  /** @type {IntentParams} */
  const params = {};
  const unit = (query.get('unit') || 'KB').toUpperCase();
  const size =
    query.has('targetSize') && /^(KB|MB)$/.test(unit)
      ? validSize(Number(query.get('targetSize')), unit)
      : null;
  if (size) Object.assign(params, size);
  const width = validSide(query.get('width'));
  const height = validSide(query.get('height'));
  if (width) params.width = width;
  if (height) params.height = height;
  const format = imageFormat(
    normalizeFormat((query.get('format') || '').toLowerCase()),
  );
  if (format) params.format = format;
  return supportedParams({ tool, params });
}
