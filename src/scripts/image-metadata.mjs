// Reads what an image file carries besides pixels: EXIF (camera, dates, software,
// orientation), GPS, XMP, IPTC, ICC colour profiles and text chunks. Pure byte
// parsing in the browser; nothing is uploaded. Used by Image Size Checker and
// Remove Image Metadata (which also re-reads its output to confirm it is clean).

const SCAN_BYTES = 512 * 1024;
const ascii = (bytes, start, length) =>
  String.fromCharCode(...bytes.subarray(start, start + length));

/** Container format from the file's signature (not its name). */
export function sniffFormat(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'JPEG';
  if (ascii(bytes, 1, 3) === 'PNG') return 'PNG';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP')
    return 'WebP';
  if (ascii(bytes, 0, 3) === 'GIF') return 'GIF';
  if (ascii(bytes, 0, 2) === 'BM') return 'BMP';
  if (ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4);
    if (/avi[fs]/.test(brand)) return 'AVIF';
    if (/hei[cx]|mif1|heim|heis/.test(brand)) return 'HEIC';
  }
  if (/^\s*<(\?xml|svg)/i.test(ascii(bytes, 0, 64))) return 'SVG';
  if (
    (bytes[0] === 0x49 && bytes[1] === 0x49) ||
    (bytes[0] === 0x4d && bytes[1] === 0x4d)
  )
    return 'TIFF';
  return 'Unknown';
}

const TAGS = {
  0x010f: 'make',
  0x0110: 'model',
  0x0112: 'orientation',
  0x0131: 'software',
  0x0132: 'modified',
  0x013b: 'artist',
  0x8298: 'copyright',
  0x9003: 'taken',
  0xa434: 'lens',
};

// Minimal TIFF/EXIF reader: IFD0, the Exif sub-IFD and the GPS IFD.
function readTiff(bytes, base) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const little = ascii(bytes, base, 2) === 'II';
  const u16 = (o) => view.getUint16(base + o, little);
  const u32 = (o) => view.getUint32(base + o, little);
  const fields = {};
  let gps = false;
  const inRange = (o, n = 2) => base + o + n <= bytes.length;
  const value = (entry, type, count) => {
    if (type === 2) {
      const at = count > 4 ? u32(entry + 8) : entry + 8;
      if (!inRange(at, count)) return '';
      return ascii(bytes, base + at, count)
        .replace(/\0+$/, '')
        .trim();
    }
    if (type === 3) return u16(entry + 8);
    if (type === 4) return u32(entry + 8);
    return undefined;
  };
  const ifd = (offset, depth = 0) => {
    if (!offset || depth > 2 || !inRange(offset)) return 0;
    const count = u16(offset);
    for (let i = 0; i < count && i < 200; i++) {
      const entry = offset + 2 + i * 12;
      if (!inRange(entry, 12)) break;
      const tag = u16(entry),
        type = u16(entry + 2),
        n = u32(entry + 4);
      if (tag === 0x8769) ifd(u32(entry + 8), depth + 1);
      else if (tag === 0x8825) {
        const g = u32(entry + 8);
        // A GPS IFD that only holds a version tag carries no location.
        gps = gps || (inRange(g) && u16(g) > 1);
      } else if (TAGS[tag]) {
        const v = value(entry, type, n);
        if (v !== undefined && v !== '') fields[TAGS[tag]] = v;
      }
    }
    return count;
  };
  if (!inRange(4, 4) || u16(2) !== 42) return { fields, gps, tags: 0 };
  const tags = ifd(u32(4));
  return { fields, gps, tags };
}

function emptyReport(format) {
  return {
    format,
    exif: false,
    gps: false,
    xmp: false,
    iptc: false,
    icc: false,
    text: false,
    comment: false,
    fields: {},
  };
}
function mergeExif(report, bytes, start) {
  const exif = readTiff(bytes, start);
  report.exif = report.exif || exif.tags > 0;
  report.gps = report.gps || exif.gps;
  Object.assign(report.fields, exif.fields);
}

function scanJpeg(bytes, report) {
  let o = 2;
  while (o + 4 <= bytes.length && bytes[o] === 0xff) {
    const marker = bytes[o + 1];
    if (marker === 0xda || marker === 0xd9) break; // image data starts
    const length = (bytes[o + 2] << 8) | bytes[o + 3];
    const body = o + 4;
    if (marker === 0xe1 && ascii(bytes, body, 6) === 'Exif\0\0')
      mergeExif(report, bytes, body + 6);
    else if (
      marker === 0xe1 &&
      ascii(bytes, body, 28).startsWith('http://ns.adobe.com/xap')
    )
      report.xmp = true;
    else if (marker === 0xed) report.iptc = true;
    else if (marker === 0xe2 && ascii(bytes, body, 11) === 'ICC_PROFILE')
      report.icc = true;
    else if (marker === 0xfe) report.comment = true;
    o += 2 + length;
  }
}

function scanPng(bytes, report) {
  let o = 8;
  while (o + 12 <= bytes.length) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + o, 8);
    const length = view.getUint32(0);
    const type = ascii(bytes, o + 4, 4);
    if (type === 'eXIf') mergeExif(report, bytes, o + 8);
    else if (type === 'iCCP') report.icc = true;
    else if (type === 'iTXt' && ascii(bytes, o + 8, 17) === 'XML:com.adobe.xmp')
      report.xmp = true;
    else if (['tEXt', 'zTXt', 'iTXt', 'tIME'].includes(type))
      report.text = true;
    else if (type === 'IDAT' || type === 'IEND') break;
    o += 12 + length;
  }
}

function scanWebp(bytes, report) {
  let o = 12;
  while (o + 8 <= bytes.length) {
    const type = ascii(bytes, o, 4);
    const length = new DataView(
      bytes.buffer,
      bytes.byteOffset + o + 4,
      4,
    ).getUint32(0, true);
    const body = o + 8;
    if (type === 'EXIF')
      mergeExif(
        report,
        bytes,
        ascii(bytes, body, 4) === 'Exif' ? body + 6 : body,
      );
    else if (type === 'XMP ') report.xmp = true;
    else if (type === 'ICCP') report.icc = true;
    o = body + length + (length % 2);
  }
}

/**
 * @param {Blob} file
 * @returns {Promise<{format:string, exif:boolean, gps:boolean, xmp:boolean, iptc:boolean, icc:boolean, text:boolean, comment:boolean, fields:Record<string, string|number>}>}
 */
export async function readMetadata(file) {
  const bytes = new Uint8Array(await file.slice(0, SCAN_BYTES).arrayBuffer());
  const report = emptyReport(sniffFormat(bytes));
  try {
    if (report.format === 'JPEG') scanJpeg(bytes, report);
    else if (report.format === 'PNG') scanPng(bytes, report);
    else if (report.format === 'WebP') scanWebp(bytes, report);
    else if (report.format === 'TIFF') mergeExif(report, bytes, 0);
  } catch {
    // A truncated or unusual header: report what was found so far.
  }
  return report;
}

/** True when the file carries anything that identifies a person, device, place or time. */
export const hasPersonalMetadata = (r) =>
  r.exif || r.gps || r.xmp || r.iptc || r.text || r.comment;

/** Short human list, e.g. ["GPS location", "Camera: Canon EOS R6", "Taken: 2024:05:01 10:22"]. */
export function describeMetadata(r) {
  const out = [];
  if (r.gps) out.push('GPS location');
  const camera = [r.fields.make, r.fields.model]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (camera) out.push(`Camera: ${camera}`);
  if (r.fields.lens) out.push(`Lens: ${r.fields.lens}`);
  if (r.fields.taken || r.fields.modified)
    out.push(`Date: ${r.fields.taken || r.fields.modified}`);
  if (r.fields.software) out.push(`Software: ${r.fields.software}`);
  if (r.fields.artist) out.push(`Author: ${r.fields.artist}`);
  if (r.exif && !out.length) out.push('EXIF data');
  if (r.xmp) out.push('XMP data');
  if (r.iptc) out.push('IPTC data');
  if (r.text) out.push('Text notes');
  if (r.comment) out.push('Comment');
  return out;
}

/** Whether any pixel is not fully opaque (sampled at most 512 px across). */
export function hasTransparency(image) {
  const s = Math.min(
    1,
    512 / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(image.naturalWidth * s));
  c.height = Math.max(1, Math.round(image.naturalHeight * s));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  try {
    ctx.drawImage(image, 0, 0, c.width, c.height);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
    return false;
  } finally {
    c.width = c.height = 0;
  }
}

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
/** "16:9", or the decimal ratio when the reduced fraction is unwieldy. */
export function aspectRatio(w, h) {
  const d = gcd(w, h);
  const [a, b] = [w / d, h / d];
  return a <= 50 && b <= 50 ? `${a}:${b}` : `${(w / h).toFixed(2)}:1`;
}
