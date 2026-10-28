// ODT (OpenDocument Text) → PDF, entirely in the browser.
// Pipeline: unzip (fflate) → tiny XML parser → style resolution → document model
// → line/page layout → PDF (pdf-lib). Text stays real, selectable text in the
// built-in PDF fonts. Documents with characters those fonts cannot encode (Hindi,
// CJK, many symbols) use the same layout but are painted with the browser's fonts
// and saved as page images (browser only; see `options.canvas`).

import { unzipSync } from 'fflate';

// No size or page caps. Only a zip-bomb guard: a package that expands to more
// than 200 times its own size (and over 512 MB) is refused as unsafe.
const BOMB_RATIO = 200;
const BOMB_FLOOR = 512 * 1024 * 1024;
const PAGE_SIZES = { a4: [595.28, 841.89], letter: [612, 792] };

// ---------------------------------------------------------------- XML

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decodeEntities(value) {
  if (!value.includes('&')) return value;
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] !== '#') return ENTITIES[code] ?? match;
    const n =
      code[1] === 'x' || code[1] === 'X'
        ? parseInt(code.slice(2), 16)
        : parseInt(code.slice(1), 10);
    return Number.isFinite(n) && n > 0 && n <= 0x10ffff
      ? String.fromCodePoint(n)
      : '';
  });
}
const NAME_END = /[\s/>]/;

/** Minimal, non-validating XML parser: elements, attributes, text, CDATA. */
export function parseXML(text) {
  const root = { name: '#root', attrs: {}, children: [] };
  const stack = [root];
  const n = text.length;
  let i = 0;
  const top = () => stack[stack.length - 1];
  const pushText = (value) => {
    if (value) top().children.push(decodeEntities(value));
  };
  while (i < n) {
    const lt = text.indexOf('<', i);
    if (lt < 0) {
      pushText(text.slice(i));
      break;
    }
    if (lt > i) pushText(text.slice(i, lt));
    const next = text[lt + 1];
    if (next === '!') {
      if (text.startsWith('<!--', lt)) {
        const end = text.indexOf('-->', lt + 4);
        i = end < 0 ? n : end + 3;
      } else if (text.startsWith('<![CDATA[', lt)) {
        const end = text.indexOf(']]>', lt + 9);
        top().children.push(text.slice(lt + 9, end < 0 ? n : end));
        i = end < 0 ? n : end + 3;
      } else {
        const end = text.indexOf('>', lt + 2);
        i = end < 0 ? n : end + 1;
      }
      continue;
    }
    if (next === '?') {
      const end = text.indexOf('?>', lt + 2);
      i = end < 0 ? n : end + 2;
      continue;
    }
    if (next === '/') {
      const end = text.indexOf('>', lt + 2);
      const name = text.slice(lt + 2, end < 0 ? n : end).trim();
      for (let k = stack.length - 1; k > 0; k--)
        if (stack[k].name === name) {
          stack.length = k;
          break;
        }
      i = end < 0 ? n : end + 1;
      continue;
    }
    let j = lt + 1;
    while (j < n && !NAME_END.test(text[j])) j++;
    const el = { name: text.slice(lt + 1, j), attrs: {}, children: [] };
    top().children.push(el);
    let closed = false;
    for (;;) {
      while (j < n && /\s/.test(text[j])) j++;
      if (j >= n) break;
      if (text[j] === '>') {
        j++;
        break;
      }
      if (text[j] === '/') {
        closed = true;
        j = text.indexOf('>', j);
        j = j < 0 ? n : j + 1;
        break;
      }
      let k = j;
      while (k < n && !/[\s=/>]/.test(text[k])) k++;
      const attr = text.slice(j, k);
      j = k;
      while (j < n && /\s/.test(text[j])) j++;
      if (text[j] === '=') {
        j++;
        while (j < n && /\s/.test(text[j])) j++;
        const quote = text[j];
        if (quote === '"' || quote === "'") {
          const end = text.indexOf(quote, j + 1);
          el.attrs[attr] = decodeEntities(text.slice(j + 1, end < 0 ? n : end));
          j = end < 0 ? n : end + 1;
        } else {
          let end = j;
          while (end < n && !/[\s>]/.test(text[end])) end++;
          el.attrs[attr] = decodeEntities(text.slice(j, end));
          j = end;
        }
      } else if (attr) el.attrs[attr] = '';
      if (!attr) j++;
    }
    if (!closed) stack.push(el);
    i = j;
  }
  return root;
}

const NS = {
  'urn:oasis:names:tc:opendocument:xmlns:office:1.0': 'office',
  'urn:oasis:names:tc:opendocument:xmlns:style:1.0': 'style',
  'urn:oasis:names:tc:opendocument:xmlns:text:1.0': 'text',
  'urn:oasis:names:tc:opendocument:xmlns:table:1.0': 'table',
  'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0': 'draw',
  'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0': 'fo',
  'urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0': 'svg',
  'http://www.w3.org/1999/xlink': 'xlink',
  'http://purl.org/dc/elements/1.1/': 'dc',
  'urn:oasis:names:tc:opendocument:xmlns:meta:1.0': 'meta',
};
// ODF files practically always use the conventional prefixes. If one does not,
// rename them so the rest of the code can match plain "text:p" names.
function canonicalPrefixes(root) {
  const docEl = root.children.find((c) => typeof c !== 'string');
  if (!docEl) return root;
  const map = {};
  for (const [key, uri] of Object.entries(docEl.attrs)) {
    if (!key.startsWith('xmlns:')) continue;
    const want = NS[uri];
    if (want && want !== key.slice(6)) map[key.slice(6)] = want;
  }
  if (!Object.keys(map).length) return root;
  const fix = (name) => {
    const c = name.indexOf(':');
    return c > 0 && map[name.slice(0, c)]
      ? map[name.slice(0, c)] + name.slice(c)
      : name;
  };
  const walk = (el) => {
    el.name = fix(el.name);
    el.attrs = Object.fromEntries(
      Object.entries(el.attrs).map(([k, v]) => [fix(k), v]),
    );
    for (const c of el.children) if (typeof c !== 'string') walk(c);
  };
  walk(root);
  return root;
}
const kids = (el) =>
  el ? el.children.filter((c) => typeof c !== 'string') : [];
const child = (el, name) => kids(el).find((c) => c.name === name);
function find(el, name) {
  if (!el) return undefined;
  for (const c of kids(el)) {
    if (c.name === name) return c;
    const hit = find(c, name);
    if (hit) return hit;
  }
  return undefined;
}
function textOf(el) {
  return el.children
    .map((c) => (typeof c === 'string' ? c : textOf(c)))
    .join('');
}

// ---------------------------------------------------------------- package

const utf8 = (bytes) => new TextDecoder('utf-8').decode(bytes);
const isZip = (b) => b[0] === 0x50 && b[1] === 0x4b;
const PACKAGE_FILES = ['mimetype', 'content.xml', 'styles.xml', 'meta.xml'];
const OTHER_OFFICE = [
  'word/document.xml',
  'xl/workbook.xml',
  'ppt/presentation.xml',
];

/** Reads an .odt/.ott package or a flat .fodt file into parsed XML parts. */
export function readODT(bytes) {
  if (!(bytes instanceof Uint8Array) || !bytes.length)
    throw new Error('This file is empty.');
  if (!isZip(bytes)) {
    const head = utf8(bytes.subarray(0, Math.min(bytes.length, 4096)));
    if (!/<office:document[\s>]/.test(head))
      throw new Error(
        'This is not an OpenDocument text file. Choose an .odt or .fodt file.',
      );
    const flat = canonicalPrefixes(parseXML(utf8(bytes)));
    const docEl = find(flat, 'office:document');
    const mime = docEl?.attrs['office:mimetype'] || '';
    if (mime && !/opendocument\.text/.test(mime))
      throw new Error('This flat OpenDocument file is not a text document.');
    return { content: flat, styles: flat, meta: flat, pictures: new Map() };
  }
  let total = 0;
  let files;
  try {
    files = unzipSync(bytes, {
      filter(file) {
        total += file.originalSize;
        if (total > BOMB_FLOOR && total > bytes.length * BOMB_RATIO)
          throw new Error(
            'This file expands to far more data than a real document. It may be damaged or unsafe.',
          );
        return (
          PACKAGE_FILES.includes(file.name) ||
          file.name === 'META-INF/manifest.xml' ||
          file.name.startsWith('Pictures/') ||
          OTHER_OFFICE.includes(file.name)
        );
      },
    });
  } catch (error) {
    if (error instanceof Error && /expands to/.test(error.message)) throw error;
    throw new Error('This ODT file is damaged or not a valid document.');
  }
  if (files['word/document.xml'])
    throw new Error(
      'This is a Word (.docx) file. Save it as .odt in Word or LibreOffice, then convert it here.',
    );
  if (files['xl/workbook.xml'] || files['ppt/presentation.xml'])
    throw new Error(
      'This is an Office spreadsheet or presentation, not an ODT text document.',
    );
  const mime = files.mimetype ? utf8(files.mimetype).trim() : '';
  if (
    mime &&
    !/^application\/vnd\.oasis\.opendocument\.text(-template|-master|-web)?$/.test(
      mime,
    )
  )
    throw new Error(
      /spreadsheet/.test(mime)
        ? 'This is a spreadsheet (.ods). Choose a text document (.odt).'
        : /presentation/.test(mime)
          ? 'This is a presentation (.odp). Choose a text document (.odt).'
          : 'This is not an OpenDocument text file. Choose an .odt file.',
    );
  const manifest = files['META-INF/manifest.xml'];
  if (manifest && /encryption-data/.test(utf8(manifest)))
    throw new Error(
      'This document is password-protected. Open it in LibreOffice, save it without a password and try again.',
    );
  if (!files['content.xml'])
    throw new Error('This ODT file has no document content.');
  const parse = (name) =>
    files[name] ? canonicalPrefixes(parseXML(utf8(files[name]))) : null;
  const pictures = new Map();
  for (const [name, data] of Object.entries(files))
    if (name.startsWith('Pictures/')) pictures.set(name, data);
  return {
    content: parse('content.xml'),
    styles: parse('styles.xml'),
    meta: parse('meta.xml'),
    pictures,
  };
}

// ---------------------------------------------------------------- units & styles

/** ODF length → points. Percentages resolve against `ref` when given. */
export function toPt(value, ref) {
  if (value == null || value === '') return undefined;
  const m = /^(-?[\d.]+)\s*(cm|mm|in|inch|pt|pc|px|%)?$/.exec(
    String(value).trim(),
  );
  if (!m) return undefined;
  const x = parseFloat(m[1]);
  if (!Number.isFinite(x)) return undefined;
  switch (m[2]) {
    case 'cm':
      return (x * 72) / 2.54;
    case 'mm':
      return (x * 72) / 25.4;
    case 'in':
    case 'inch':
      return x * 72;
    case 'pc':
      return x * 12;
    case 'px':
      return x * 0.75;
    case '%':
      return ref != null ? (x / 100) * ref : undefined;
    default:
      return x;
  }
}
const COLOR = /^#[0-9a-f]{6}$/i;
const color = (value) => (COLOR.test(value || '') ? value : null);

/** Maps a font family name to one of the three built-in PDF font families. */
export function fontKind(name, generic) {
  const s = String(name || '').toLowerCase();
  if (
    /mono|courier|consol|menlo|typewriter|fixed|code/.test(s) ||
    generic === 'modern'
  )
    return 'mono';
  if (
    /sans|arial|helvetica|calibri|carlito|verdana|tahoma|segoe|roboto|ubuntu|lato|manrope|inter\b|trebuchet|gill|futura|avenir|open|source|franklin|gothic|candara|corbel/.test(
      s,
    )
  )
    return 'sans';
  if (
    /serif|times|georgia|cambria|caladea|garamond|book|palatino|baskerville|minion|constantia|bodoni|didot/.test(
      s,
    ) ||
    generic === 'roman'
  )
    return 'serif';
  return 'sans';
}

function styleIndex(parts) {
  const common = new Map(),
    contentAuto = new Map(),
    stylesAuto = new Map(),
    defaults = new Map(),
    listsCommon = new Map(),
    listsContent = new Map(),
    listsStyles = new Map(),
    layouts = new Map(),
    masters = [],
    fonts = new Map();
  const register = (container, styleMap, listMap) => {
    for (const el of kids(container)) {
      if (el.name === 'style:style')
        styleMap.set(
          `${el.attrs['style:family']}:${el.attrs['style:name']}`,
          el,
        );
      else if (el.name === 'style:default-style')
        defaults.set(el.attrs['style:family'], el);
      else if (el.name === 'text:list-style')
        listMap.set(el.attrs['style:name'], el);
      else if (el.name === 'style:page-layout')
        layouts.set(el.attrs['style:name'], el);
    }
  };
  const flat = parts.content === parts.styles;
  for (const doc of flat ? [parts.content] : [parts.styles, parts.content]) {
    for (const face of kids(find(doc, 'office:font-face-decls')))
      fonts.set(
        face.attrs['style:name'],
        fontKind(
          face.attrs['svg:font-family'] || face.attrs['style:name'],
          face.attrs['style:font-family-generic'],
        ),
      );
  }
  if (parts.styles) {
    register(find(parts.styles, 'office:styles'), common, listsCommon);
    register(
      find(parts.styles, 'office:automatic-styles'),
      stylesAuto,
      listsStyles,
    );
    for (const m of kids(find(parts.styles, 'office:master-styles')))
      if (m.name === 'style:master-page') masters.push(m);
  }
  if (flat) {
    for (const [k, v] of stylesAuto) contentAuto.set(k, v);
    for (const [k, v] of listsStyles) listsContent.set(k, v);
  } else if (parts.content) {
    register(find(parts.content, 'office:styles'), common, listsCommon);
    register(
      find(parts.content, 'office:automatic-styles'),
      contentAuto,
      listsContent,
    );
  }
  return {
    fonts,
    defaults,
    layouts,
    masters,
    // Body text uses content.xml's automatic styles; headers/footers use styles.xml's.
    scope(kind) {
      const auto = kind === 'page' ? stylesAuto : contentAuto;
      const lists = kind === 'page' ? listsStyles : listsContent;
      const lookup = (family, name) =>
        name == null
          ? undefined
          : auto.get(`${family}:${name}`) || common.get(`${family}:${name}`);
      // Root-first chain: default style, ancestors, then the style itself.
      const chain = (family, name) => {
        const out = [];
        const seen = new Set();
        let el = lookup(family, name);
        while (el && !seen.has(el)) {
          seen.add(el);
          out.unshift(el);
          const parent = el.attrs['style:parent-style-name'];
          el = parent
            ? common.get(`${family}:${parent}`) || lookup(family, parent)
            : undefined;
        }
        const def = defaults.get(family);
        if (def) out.unshift(def);
        return out;
      };
      const list = (name) =>
        name ? lists.get(name) || listsCommon.get(name) : undefined;
      return { chain, list };
    },
  };
}
const props = (el, name) => child(el, name)?.attrs;
function mergedProps(chain, name) {
  const out = {};
  for (const el of chain) Object.assign(out, props(el, name) || {});
  return out;
}

const BASE_TEXT = {
  kind: 'serif',
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  size: 12,
  color: '#000000',
  bg: null,
  pos: 0,
  rel: 1,
  upper: false,
  hidden: false,
};
function applyText(base, a, fonts) {
  if (!a) return base;
  const s = { ...base };
  const size = a['fo:font-size'];
  if (size) {
    const v = size.endsWith('%')
      ? (base.size * parseFloat(size)) / 100
      : toPt(size);
    if (v > 0 && v < 1000) s.size = v;
  }
  const weight = a['fo:font-weight'];
  if (weight) s.bold = /^(bold|bolder|[6-9]00)$/.test(weight);
  if (a['fo:font-style']) s.italic = a['fo:font-style'] !== 'normal';
  const under = a['style:text-underline-style'];
  if (under) s.underline = under !== 'none';
  const through = a['style:text-line-through-style'];
  if (through) s.strike = through !== 'none';
  if (color(a['fo:color'])) s.color = a['fo:color'];
  if (a['style:use-window-font-color'] === 'true') s.color = '#000000';
  if (a['fo:background-color']) s.bg = color(a['fo:background-color']);
  if (a['style:font-name'])
    s.kind = fonts.get(a['style:font-name']) || fontKind(a['style:font-name']);
  else if (a['fo:font-family'])
    s.kind = fontKind(a['fo:font-family'], a['style:font-family-generic']);
  const position = a['style:text-position'];
  if (position) {
    const [p, r] = position.split(/\s+/);
    s.pos = p === 'super' ? 33 : p === 'sub' ? -33 : parseFloat(p) || 0;
    s.rel = r ? parseFloat(r) / 100 || 1 : s.pos ? 0.58 : 1;
  }
  if (a['fo:text-transform']) s.upper = a['fo:text-transform'] === 'uppercase';
  if (a['text:display'] === 'none') s.hidden = true;
  return s;
}
function paragraphProps(a, width) {
  const align = a['fo:text-align'];
  const lh = a['fo:line-height'];
  return {
    ml: toPt(a['fo:margin-left'], width) || 0,
    mr: toPt(a['fo:margin-right'], width) || 0,
    mt: Math.max(0, toPt(a['fo:margin-top']) || 0),
    mb: Math.max(0, toPt(a['fo:margin-bottom']) || 0),
    indent: toPt(a['fo:text-indent'], width) || 0,
    align:
      align === 'center'
        ? 'center'
        : align === 'end' || align === 'right'
          ? 'right'
          : align === 'justify'
            ? 'justify'
            : 'left',
    lhPct: lh && lh.endsWith('%') ? parseFloat(lh) / 100 || 1 : null,
    lhFixed: lh && !lh.endsWith('%') && lh !== 'normal' ? toPt(lh) : null,
    lhMin: toPt(a['style:line-height-at-least']) || 0,
    lhAdd: toPt(a['style:line-spacing']) || 0,
    breakBefore: a['fo:break-before'] === 'page',
    breakAfter: a['fo:break-after'] === 'page',
    keepNext: a['fo:keep-with-next'] === 'always',
    bg: color(a['fo:background-color']),
  };
}

// ---------------------------------------------------------------- document model

const SKIP = new Set([
  'text:tracked-changes',
  'office:forms',
  'text:variable-decls',
  'text:sequence-decls',
  'text:user-field-decls',
  'text:dde-connection-decls',
  'table:named-expressions',
  'office:annotation',
  'office:annotation-end',
  'text:table-of-content-source',
  'text:alphabetical-index-source',
  'text:illustration-index-source',
  'text:table-index-source',
  'text:object-index-source',
  'text:user-index-source',
  'text:bibliography-source',
  'text:bookmark',
  'text:bookmark-start',
  'text:bookmark-end',
  'text:reference-mark',
  'text:reference-mark-start',
  'text:reference-mark-end',
  'text:alphabetical-index-mark',
  'text:toc-mark',
  'text:change',
  'text:change-start',
  'text:change-end',
  'text:soft-page-break',
  'draw:contour-polygon',
  'svg:title',
  'svg:desc',
]);
const CONTAINERS = new Set([
  'office:text',
  'text:section',
  'text:index-body',
  'text:table-of-content',
  'text:alphabetical-index',
  'text:illustration-index',
  'text:table-index',
  'text:object-index',
  'text:user-index',
  'text:bibliography',
  'text:index-title',
]);
const ROMAN = [
  [1000, 'm'],
  [900, 'cm'],
  [500, 'd'],
  [400, 'cd'],
  [100, 'c'],
  [90, 'xc'],
  [50, 'l'],
  [40, 'xl'],
  [10, 'x'],
  [9, 'ix'],
  [5, 'v'],
  [4, 'iv'],
  [1, 'i'],
];
function formatNumber(n, format) {
  if (format === '') return '';
  if (format === 'i' || format === 'I') {
    let out = '';
    for (const [v, s] of ROMAN) while (n >= v) ((out += s), (n -= v));
    return format === 'I' ? out.toUpperCase() : out;
  }
  if (format === 'a' || format === 'A') {
    let out = '';
    while (n > 0) {
      n--;
      out = String.fromCharCode(97 + (n % 26)) + out;
      n = Math.floor(n / 26);
    }
    return format === 'A' ? out.toUpperCase() : out;
  }
  return String(n);
}
const BULLETS = ['•', '◦', '▪'];
const PUA = /[\ue000-\uf8ff]/;
function listLabel(levelEl, numbers, level) {
  if (!levelEl) return BULLETS[(level - 1) % 3];
  if (levelEl.name === 'text:list-level-style-number') {
    const fmt = levelEl.attrs['style:num-format'] ?? '1';
    const shown = Math.max(
      1,
      Number(levelEl.attrs['text:display-levels'] || 1),
    );
    const body =
      fmt === ''
        ? ''
        : numbers
            .slice(-shown)
            .map((n) => formatNumber(n, fmt))
            .join('.');
    return `${levelEl.attrs['style:num-prefix'] || ''}${body}${levelEl.attrs['style:num-suffix'] || ''}`;
  }
  const char = levelEl.attrs['text:bullet-char'] || '•';
  return PUA.test(char) ? BULLETS[(level - 1) % 3] : char;
}
function listGeometry(levelEl, level) {
  const lp = child(levelEl, 'style:list-level-properties');
  const align = child(lp, 'style:list-level-label-alignment');
  if (align && toPt(align.attrs['fo:margin-left']) != null)
    return {
      ml: toPt(align.attrs['fo:margin-left']),
      indent: toPt(align.attrs['fo:text-indent']) ?? -18,
    };
  if (
    lp &&
    (lp.attrs['text:space-before'] || lp.attrs['text:min-label-width'])
  ) {
    const before = toPt(lp.attrs['text:space-before']) || 0;
    const min = toPt(lp.attrs['text:min-label-width']) || 18;
    return { ml: before + min, indent: -min };
  }
  return { ml: 18 * level + 18, indent: -18 };
}

/** Reads width/height and type from image bytes (no decoding). */
export function imageInfo(b) {
  const u32 = (i) =>
    ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e)
    return { mime: 'image/png', w: u32(16), h: u32(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const m = b[i + 1];
      if (m === 0xff) {
        i++;
        continue;
      }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
        i += 2;
        continue;
      }
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m))
        return {
          mime: 'image/jpeg',
          h: (b[i + 5] << 8) | b[i + 6],
          w: (b[i + 7] << 8) | b[i + 8],
        };
      i += 2 + ((b[i + 2] << 8) | b[i + 3]);
    }
    return { mime: 'image/jpeg', w: 0, h: 0 };
  }
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46)
    return { mime: 'image/gif', w: b[6] | (b[7] << 8), h: b[8] | (b[9] << 8) };
  if (b[0] === 0x42 && b[1] === 0x4d)
    return {
      mime: 'image/bmp',
      w: Math.abs(u32le(b, 18)),
      h: Math.abs(u32le(b, 22)),
    };
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45)
    return { mime: 'image/webp', w: 0, h: 0 };
  const head = new TextDecoder().decode(b.subarray(0, 400));
  if (/<svg[\s>]/i.test(head)) return { mime: 'image/svg+xml', w: 0, h: 0 };
  return { mime: '', w: 0, h: 0 };
}
const u32le = (b, i) =>
  b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24);

class Builder {
  constructor(index, kind, warn, pictures, width) {
    this.s = index.scope(kind);
    this.fonts = index.fonts;
    this.warn = warn;
    this.pictures = pictures;
    this.width = width;
    this.notes = [];
    this.noteCount = 0;
    this.imageCount = 0;
    this.counters = new Map();
  }
  paraStyle(name, heading) {
    const chain = this.s.chain('paragraph', name);
    let text = BASE_TEXT;
    for (const el of chain)
      text = applyText(text, props(el, 'style:text-properties'), this.fonts);
    const pp = paragraphProps(
      mergedProps(chain, 'style:paragraph-properties'),
      this.width,
    );
    // Headings without their own styling still look like headings.
    const styled = chain.some(
      (el) =>
        el.name === 'style:style' &&
        props(el, 'style:text-properties')?.['fo:font-size'],
    );
    if (heading && !styled) {
      text = {
        ...text,
        bold: true,
        size: text.size * ([0, 1.6, 1.35, 1.17][heading] || 1.05),
      };
      if (!pp.mt) pp.mt = 12;
      if (!pp.mb) pp.mb = 6;
    }
    if (heading) pp.keepNext = true;
    let listStyle;
    for (const el of chain)
      listStyle = el.attrs['style:list-style-name'] || listStyle;
    const self = chain[chain.length - 1];
    return {
      text,
      pp,
      listStyle,
      master: self?.attrs['style:master-page-name'],
    };
  }
  spanStyle(base, name) {
    if (!name) return base;
    let s = base;
    for (const el of this.s.chain('text', name))
      if (el.name === 'style:style')
        s = applyText(s, props(el, 'style:text-properties'), this.fonts);
    return s;
  }
  blocks(nodes, list) {
    const out = [];
    for (const node of nodes || []) {
      if (typeof node === 'string') continue;
      const name = node.name;
      if (SKIP.has(name)) continue;
      if (name === 'text:p' || name === 'text:h')
        out.push(...this.paragraph(node, list));
      else if (name === 'text:list') out.push(...this.list(node, list));
      else if (name === 'table:table') out.push(this.table(node));
      else if (name === 'draw:frame' || name === 'draw:a')
        out.push(...this.frameBlocks(node, 'left'));
      else if (CONTAINERS.has(name))
        out.push(...this.blocks(node.children, list));
      else if (name.startsWith('draw:')) this.warn('shape');
    }
    return out;
  }
  paragraph(el, list) {
    const heading =
      el.name === 'text:h'
        ? Math.max(1, Number(el.attrs['text:outline-level'] || 1))
        : 0;
    const style = this.paraStyle(el.attrs['text:style-name'], heading);
    const items = [];
    const after = [];
    this.inline(
      el.children,
      style.text,
      items,
      after,
      { space: true },
      style.pp.align,
    );
    // Trailing collapsible spaces never print.
    while (
      items.length &&
      items[items.length - 1].text !== undefined &&
      !items[items.length - 1].hard &&
      !items[items.length - 1].text.trim()
    )
      items.pop();
    const last = items[items.length - 1];
    if (last && last.text !== undefined && !last.hard)
      last.text = last.text.replace(/ +$/, '');
    const block = { type: 'p', items, pp: style.pp, base: style.text, heading };
    if (list) {
      block.pp = { ...style.pp, ml: list.ml, indent: list.indent };
      if (list.label != null)
        block.label = {
          text: list.label,
          st: this.spanStyle(style.text, list.labelStyle),
        };
      list.label = null;
    }
    return [block, ...after];
  }
  inline(nodes, st, items, after, state, align) {
    for (const node of nodes) {
      if (typeof node === 'string') {
        let t = node.replace(/[\t\n\r ]+/g, ' ');
        if (state.space) t = t.replace(/^ /, '');
        if (!t) continue;
        state.space = t.endsWith(' ');
        if (!st.hidden)
          items.push({ text: st.upper ? t.toUpperCase() : t, st });
        continue;
      }
      const name = node.name;
      if (SKIP.has(name)) continue;
      switch (name) {
        case 'text:span':
          this.inline(
            node.children,
            this.spanStyle(st, node.attrs['text:style-name']),
            items,
            after,
            state,
            align,
          );
          break;
        case 'text:s':
          items.push({
            text: ' '.repeat(Math.min(200, Number(node.attrs['text:c'] || 1))),
            st,
            hard: true,
          });
          state.space = true;
          break;
        case 'text:tab':
          items.push({ tab: true, st });
          state.space = true;
          break;
        case 'text:line-break':
          items.push({ br: true, st });
          state.space = true;
          break;
        case 'text:page-number':
        case 'text:page-count':
          items.push({
            field: name === 'text:page-number' ? 'page' : 'pages',
            st,
          });
          state.space = false;
          break;
        case 'text:note': {
          const citation = child(node, 'text:note-citation');
          const label =
            (citation && textOf(citation).trim()) || String(++this.noteCount);
          items.push({ text: label, st: { ...st, pos: 33, rel: 0.58 } });
          const body = child(node, 'text:note-body');
          if (body) this.notes.push({ label, nodes: body.children });
          state.space = false;
          break;
        }
        case 'draw:frame':
        case 'draw:a': {
          const frames =
            name === 'draw:a'
              ? kids(node).filter((k) => k.name === 'draw:frame')
              : [node];
          for (const frame of frames) {
            const image =
              frame.attrs['text:anchor-type'] === 'as-char'
                ? this.image(frame)
                : null;
            if (image) {
              items.push({ img: image, st });
              state.space = false;
            } else after.push(...this.frameBlocks(frame, align));
          }
          break;
        }
        default:
          if (name.startsWith('draw:')) this.warn('shape');
          // Fields, links, ruby, metadata spans: keep their visible text.
          else this.inline(node.children, st, items, after, state, align);
      }
    }
  }
  image(frame) {
    const images = kids(frame).filter((k) => k.name === 'draw:image');
    if (!images.length) return null;
    const w = toPt(frame.attrs['svg:width']);
    const h = toPt(frame.attrs['svg:height']);
    for (const img of images) {
      const href = (img.attrs['xlink:href'] || '').replace(/^\.\//, '');
      let bytes = href ? this.pictures.get(href) : undefined;
      const binary = child(img, 'office:binary-data');
      if (!bytes && binary) {
        try {
          const raw = atob(textOf(binary).replace(/\s+/g, ''));
          bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
        } catch {
          bytes = undefined;
        }
      }
      if (!bytes) continue;
      const info = imageInfo(bytes);
      if (!info.mime) continue;
      const ratio = info.w && info.h ? info.h / info.w : 0.75;
      const width = w || (h && ratio ? h / ratio : info.w * 0.75) || 144;
      const height = h || width * ratio;
      return {
        bytes,
        mime: info.mime,
        w: width,
        h: height,
        key: href || `inline-${++this.imageCount}`,
      };
    }
    this.warn('image');
    return null;
  }
  frameBlocks(frame, align) {
    if (frame.name === 'draw:a')
      return kids(frame).flatMap((f) =>
        f.name === 'draw:frame' ? this.frameBlocks(f, align) : [],
      );
    const image = this.image(frame);
    if (image) return [{ type: 'img', img: image, align }];
    const box = child(frame, 'draw:text-box');
    if (box) return this.blocks(box.children);
    if (child(frame, 'draw:object') || child(frame, 'draw:object-ole'))
      this.warn('object');
    return [];
  }
  list(el, parent, level = 1) {
    const styleName = el.attrs['text:style-name'] || parent?.styleName;
    const levels = kids(this.s.list(styleName));
    const levelEl = levels.find(
      (k) => Number(k.attrs['text:level'] || 1) === level,
    );
    const key = `${styleName}|${level}`;
    const resume =
      el.attrs['text:continue-numbering'] === 'true' ||
      el.attrs['text:continue-list'];
    let count = resume ? this.counters.get(key) || 0 : 0;
    const geometry = listGeometry(levelEl, level);
    const out = [];
    for (const item of kids(el)) {
      if (item.name !== 'text:list-item' && item.name !== 'text:list-header')
        continue;
      const header = item.name === 'text:list-header';
      if (!header)
        count = item.attrs['text:start-value']
          ? Number(item.attrs['text:start-value']) || 1
          : count + 1;
      const ctx = {
        styleName,
        numbers: [...(parent?.numbers || []), count],
        ml: geometry.ml,
        indent: geometry.indent,
        labelStyle: levelEl?.attrs['text:style-name'],
      };
      ctx.label = header ? null : listLabel(levelEl, ctx.numbers, level);
      for (const node of kids(item)) {
        if (node.name === 'text:list')
          out.push(...this.list(node, ctx, level + 1));
        else out.push(...this.blocks([node], ctx));
      }
    }
    this.counters.set(key, count);
    return out;
  }
  table(el) {
    const tp = mergedProps(
      this.s.chain('table', el.attrs['table:style-name']),
      'style:table-properties',
    );
    const columns = [];
    const rows = [];
    const collect = (node, header) => {
      for (const k of kids(node)) {
        if (k.name === 'table:table-column') {
          const repeat = Math.min(
            512,
            Number(k.attrs['table:number-columns-repeated'] || 1),
          );
          const cp = mergedProps(
            this.s.chain('table-column', k.attrs['table:style-name']),
            'style:table-column-properties',
          );
          for (let i = 0; i < repeat; i++)
            columns.push({
              abs: toPt(cp['style:column-width']),
              rel:
                parseFloat(
                  cp['style:rel-width'] || cp['style:rel-column-width'],
                ) || 0,
            });
        } else if (k.name === 'table:table-header-rows') collect(k, true);
        else if (
          /^table:table-(columns|column-group|rows|row-group)$/.test(k.name)
        )
          collect(k, header);
        else if (k.name === 'table:table-row') {
          const repeat = Math.min(
            100,
            Number(k.attrs['table:number-rows-repeated'] || 1),
          );
          const rp = mergedProps(
            this.s.chain('table-row', k.attrs['table:style-name']),
            'style:table-row-properties',
          );
          const cells = [];
          for (const c of kids(k)) {
            const repeatC = Math.min(
              512,
              Number(c.attrs['table:number-columns-repeated'] || 1),
            );
            for (let i = 0; i < repeatC; i++) {
              if (c.name === 'table:covered-table-cell')
                cells.push({ covered: true });
              else if (c.name === 'table:table-cell')
                cells.push({
                  span: Math.max(
                    1,
                    Number(c.attrs['table:number-columns-spanned'] || 1),
                  ),
                  blocks: this.blocks(c.children),
                  props: mergedProps(
                    this.s.chain('table-cell', c.attrs['table:style-name']),
                    'style:table-cell-properties',
                  ),
                });
            }
          }
          const minH =
            toPt(rp['style:min-row-height']) ||
            toPt(rp['style:row-height']) ||
            0;
          for (let i = 0; i < repeat; i++) rows.push({ cells, header, minH });
        }
      }
    };
    collect(el, false);
    return {
      type: 'table',
      columns,
      rows,
      width: toPt(tp['style:width']),
      align: tp['table:align'] || 'margins',
      ml: toPt(tp['fo:margin-left']) || 0,
      mt: toPt(tp['fo:margin-top']) || 0,
      mb: toPt(tp['fo:margin-bottom']) || 0,
      breakBefore: tp['fo:break-before'] === 'page',
    };
  }
}

function pageGeometry(index, masterName) {
  const master =
    index.masters.find((m) => m.attrs['style:name'] === masterName) ||
    index.masters.find((m) => /^Standard$/.test(m.attrs['style:name'])) ||
    index.masters[0];
  const layout = master
    ? index.layouts.get(master.attrs['style:page-layout-name'])
    : undefined;
  const pl = props(layout, 'style:page-layout-properties') || {};
  const margin = (side) =>
    toPt(pl[`fo:margin-${side}`]) ?? toPt(pl['fo:margin']) ?? 56.7;
  const area = (name, gapKey) => {
    const el =
      name === 'style:header'
        ? child(master, 'style:header')
        : child(master, 'style:footer');
    if (!el || el.attrs['style:display'] === 'false') return null;
    const p =
      props(child(layout, `${name}-style`), 'style:header-footer-properties') ||
      {};
    return {
      nodes: el.children,
      gap: toPt(p[gapKey]) ?? 14,
      minH: toPt(p['fo:min-height']) || 0,
    };
  };
  return {
    width: toPt(pl['fo:page-width']) || 595.28,
    height: toPt(pl['fo:page-height']) || 841.89,
    top: margin('top'),
    bottom: margin('bottom'),
    left: margin('left'),
    right: margin('right'),
    header: area('style:header', 'fo:margin-bottom'),
    footer: area('style:footer', 'fo:margin-top'),
  };
}

/** Parses an ODT into a layout-ready document model. Pure JavaScript (no DOM). */
export function buildDocument(parts, options = {}) {
  const index = styleIndex(parts);
  const warnings = new Set();
  const warn = (w) => warnings.add(w);
  const body = find(parts.content, 'office:text');
  if (!body)
    throw new Error(
      'This file has no text body. It may be a different OpenDocument type.',
    );
  // The first paragraph's style may name a master page with its own page size.
  const firstPara = find(body, 'text:p') || find(body, 'text:h');
  const probe = new Builder(index, 'content', warn, parts.pictures, 500);
  const master = firstPara
    ? probe.paraStyle(firstPara.attrs['text:style-name'], 0).master
    : undefined;
  const page = pageGeometry(index, master);
  if (PAGE_SIZES[options.pageSize]) {
    let [w, h] = PAGE_SIZES[options.pageSize];
    if (page.width > page.height) [w, h] = [h, w];
    page.width = w;
    page.height = h;
  }
  if (!(
    page.width >= 72 &&
    page.width <= 14400 &&
    page.height >= 72 &&
    page.height <= 14400
  )) {
    page.width = 595.28;
    page.height = 841.89;
  }
  // Keep a usable body area whatever the margins say.
  const clamp = (v, total) => Math.min(Math.max(0, v), total * 0.35);
  page.left = clamp(page.left, page.width);
  page.right = clamp(page.right, page.width);
  page.top = clamp(page.top, page.height);
  page.bottom = clamp(page.bottom, page.height);
  const contentWidth = page.width - page.left - page.right;
  const builder = new Builder(
    index,
    'content',
    warn,
    parts.pictures,
    contentWidth,
  );
  const blocks = builder.blocks(body.children);
  if (builder.notes.length) {
    blocks.push({ type: 'rule' });
    for (const note of builder.notes) {
      const nb = builder.blocks(note.nodes);
      const first = nb.find((b) => b.type === 'p');
      if (first)
        first.items.unshift({ text: `${note.label}. `, st: first.base });
      for (const b of nb)
        if (b.type === 'p') {
          b.base = { ...b.base, size: b.base.size * 0.85 };
          b.items = b.items.map((it) =>
            it.st ? { ...it, st: { ...it.st, size: it.st.size * 0.85 } } : it,
          );
        }
      blocks.push(...nb);
    }
  }
  const pageBuilder = new Builder(
    index,
    'page',
    warn,
    parts.pictures,
    contentWidth,
  );
  const header = page.header ? pageBuilder.blocks(page.header.nodes) : null;
  const footer = page.footer ? pageBuilder.blocks(page.footer.nodes) : null;
  const titleEl = parts.meta ? find(parts.meta, 'dc:title') : null;
  const title = titleEl ? textOf(titleEl).trim().slice(0, 200) : '';
  const defaults =
    props(index.defaults.get('paragraph'), 'style:paragraph-properties') || {};
  const tabDist = toPt(defaults['style:tab-stop-distance']) || 35.4;
  return { page, blocks, header, footer, title, tabDist, warnings };
}

// ---------------------------------------------------------------- text encoding

const WIN_ANSI = new Set([
  0x152, 0x153, 0x160, 0x161, 0x178, 0x17d, 0x17e, 0x192, 0x2c6, 0x2dc, 0x2013,
  0x2014, 0x2018, 0x2019, 0x201a, 0x201c, 0x201d, 0x201e, 0x2020, 0x2021,
  0x2022, 0x2026, 0x2030, 0x2039, 0x203a, 0x20ac, 0x2122,
]);
/** Characters the built-in PDF fonts (WinAnsi encoding) can write. */
export const winAnsi = (cp) =>
  (cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) || WIN_ANSI.has(cp);
const LOOKALIKES = [
  [/[\u00ad\u200b-\u200d\u2060\ufeff]/g, ''],
  [/[\u2010-\u2012\u2212]/g, '-'],
  [/\u2015/g, '—'],
  [/[\u2000-\u200a\u202f\u205f]/g, ' '],
  [/\u2032/g, "'"],
  [/\u2033/g, '"'],
  [/[\u2044\u2215]/g, '/'],
  [/[\u2219\u22c5]/g, '·'],
  [/\u2192/g, '->'],
  [/\u2190/g, '<-'],
  [/\u2264/g, '<='],
  [/\u2265/g, '>='],
  [/\u2260/g, '!='],
  [/\ufb01/g, 'fi'],
  [/\ufb02/g, 'fl'],
  [/[◦○]/g, 'o'],
  [/[▪■●➢➤►✓✔☐]/g, '•'],
  [/★/g, '*'],
];
/** Normalizes text; with `ansi`, maps safe look-alikes into the PDF fonts' range. */
export function cleanText(text, ansi) {
  let t = text.normalize('NFC');
  if (!ansi) return t.replace(/[\u00ad\u200b\u2060\ufeff]/g, '');
  for (const [re, to] of LOOKALIKES) t = t.replace(re, to);
  return t;
}
/** True when every character can be written with the built-in PDF fonts. */
export function fitsWinAnsi(model) {
  const fits = (s) =>
    [...cleanText(s, true)].every((ch) => winAnsi(ch.codePointAt(0)));
  const visit = (blocks) =>
    (blocks || []).every((b) =>
      b.type === 'p'
        ? b.items.every((it) => !it.text || fits(it.text)) &&
          (!b.label || fits(b.label.text))
        : b.type === 'table'
          ? b.rows.every((r) =>
              r.cells.every((c) => !c.blocks || visit(c.blocks)),
            )
          : true,
    );
  return visit(model.blocks) && visit(model.header) && visit(model.footer);
}

// ---------------------------------------------------------------- layout

const ASC = 0.905;
const DESC = 0.212;
const LINE = 1.15;
// Break opportunities: after runs of spaces, and between CJK characters.
const CJK = '\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uff00-\uffef';
const BREAK = new RegExp(`[^ \\t${CJK}]+[ ]*|[${CJK}][ ]*|[ ]+`, 'g');
const eff = (st) => st.size * (st.rel || 1);
const rise = (st) => (st.size * (st.pos || 0)) / 100;
const gapBetween = (units, k) =>
  k ? units[k].before + units[k - 1].after : units[k].before;
const stackHeight = (units) =>
  units.reduce((h, u, k) => h + gapBetween(units, k) + u.h, 0) +
  (units.length ? units[units.length - 1].after : 0);
function shift(op, dx, dy) {
  return op.t === 'line'
    ? { ...op, x1: op.x1 + dx, x2: op.x2 + dx, y1: op.y1 + dy, y2: op.y2 + dy }
    : { ...op, x: op.x + dx, y: op.y + dy };
}
function parseBorder(value) {
  if (!value || value === 'none') return null;
  let w = 0.5;
  let stroke = '#000000';
  for (const part of value.split(/\s+/)) {
    if (part === 'none' || part === 'hidden') return null;
    if (COLOR.test(part)) stroke = part;
    else if (part === 'medium') w = 1;
    else if (part === 'thick') w = 1.5;
    else if (toPt(part) != null) w = toPt(part);
  }
  return w > 0 ? { w: Math.min(w, 6), color: stroke } : null;
}

class Layout {
  constructor(measure, model) {
    this.measure = measure;
    this.model = model;
    this.fields = { page: 1, pages: 1 };
  }
  word(text, st) {
    const word = text.replace(/ +$/, '');
    return {
      text,
      word,
      st,
      w: word ? this.measure.width(word, st) : 0,
      sw:
        text.length > word.length
          ? this.measure.width(text.slice(word.length), st)
          : 0,
    };
  }
  atoms(p) {
    const out = [];
    for (const it of p.items) {
      if (it.br || it.tab) out.push({ ...it });
      else if (it.img)
        out.push({ img: it.img, st: it.st, w: it.img.w, h: it.img.h, sw: 0 });
      else {
        const raw = it.field
          ? String(this.fields[it.field])
          : cleanText(it.text, this.measure.ansi);
        for (const m of raw.matchAll(BREAK)) out.push(this.word(m[0], it.st));
      }
    }
    return out;
  }
  // A word wider than the line is split into pieces that fit.
  splitWord(atom, avail) {
    const chars = [...atom.word];
    let fit = 1;
    for (let i = 2; i <= chars.length; i++) {
      if (this.measure.width(chars.slice(0, i).join(''), atom.st) > avail)
        break;
      fit = i;
    }
    return [
      this.word(chars.slice(0, fit).join(''), atom.st),
      this.word(
        chars.slice(fit).join('') + atom.text.slice(atom.word.length),
        atom.st,
      ),
    ];
  }
  blocks(blocks, width) {
    const units = [];
    for (const b of blocks || []) {
      if (b.type === 'p') units.push(...this.paragraph(b, width));
      else if (b.type === 'table') units.push(...this.table(b, width));
      else if (b.type === 'img') units.push(this.imageUnit(b, width));
      else if (b.type === 'rule')
        units.push({
          h: 12,
          before: 12,
          after: 0,
          ops: [
            {
              t: 'line',
              x1: 0,
              y1: 6,
              x2: Math.min(144, width),
              y2: 6,
              w: 0.5,
              color: '#808080',
            },
          ],
        });
    }
    // Headings stay with the line that follows them.
    for (let i = 0; i < units.length; i++) {
      if (!units[i].keepStart) continue;
      let j = i;
      let h = 0;
      while (j < units.length && units[j].group === units[i].group)
        h += gapBetween(units, j) * (j > i) + units[j++].h;
      if (units[j]) h += gapBetween(units, j) + units[j].h;
      units[i].keepH = h;
    }
    return units;
  }
  imageUnit(b, width) {
    const scale = Math.min(
      1,
      width / b.img.w,
      (this.model.bodyH || 700) / b.img.h,
    );
    const w = b.img.w * scale;
    const h = b.img.h * scale;
    const x =
      b.align === 'center'
        ? (width - w) / 2
        : b.align === 'right'
          ? width - w
          : 0;
    return {
      h,
      before: 2,
      after: 2,
      ops: [{ t: 'img', x, y: 0, w, h, img: b.img }],
    };
  }
  fillLines(p, atoms, ml, right) {
    const lines = [];
    const pp = p.pp;
    let i = 0;
    let first = true;
    while (first || i < atoms.length) {
      let start = first ? Math.max(0, ml + pp.indent) : ml;
      let label = null;
      if (first && p.label) {
        const text = cleanText(p.label.text, this.measure.ansi);
        const w = this.measure.width(text, p.label.st);
        label = { text, x: start, st: p.label.st };
        const end = start + w + eff(p.label.st) * 0.5;
        start = end > ml ? end : ml;
      }
      const line = [];
      let x = start;
      let broke = false;
      while (i < atoms.length) {
        const a = atoms[i];
        if (a.br) {
          i++;
          broke = true;
          break;
        }
        if (a.tab) {
          const dist = this.model.tabDist || 35.4;
          const next = Math.min(
            right,
            ml + (Math.floor((x - ml) / dist + 1e-6) + 1) * dist,
          );
          if (next >= right && line.some((l) => !l.tab)) break;
          line.push({ ...a, x, w: next - x, sw: 0 });
          x = next;
          i++;
          continue;
        }
        if (x + a.w > right + 0.01) {
          if (line.some((l) => !l.tab)) break;
          if (a.img) {
            line.push({ ...a, x });
            i++;
            break;
          }
          const [head, tail] = this.splitWord(a, right - x);
          line.push({ ...head, x });
          atoms[i] = tail;
          break;
        }
        line.push({ ...a, x });
        x += a.w + a.sw;
        i++;
      }
      lines.push({ atoms: line, start, broke, label });
      first = false;
      if (lines.length > 50000) break;
    }
    return lines;
  }
  paragraph(p, width) {
    const pp = p.pp;
    const right = Math.max(width - Math.max(0, pp.mr), 20);
    const ml = Math.min(Math.max(0, pp.ml), right - 20);
    const lines = this.fillLines(p, this.atoms(p), ml, right);
    const group = {};
    return lines.map((line, n) => {
      const last = n === lines.length - 1;
      let size = line.label ? eff(line.label.st) : 0;
      let imgH = 0;
      for (const a of line.atoms) {
        if (a.img) imgH = Math.max(imgH, a.h);
        else if (!a.tab) size = Math.max(size, eff(a.st));
      }
      if (!size) size = eff(p.base);
      let lineH = pp.lhFixed || size * LINE * (pp.lhPct || 1);
      lineH = Math.max(lineH, pp.lhMin) + pp.lhAdd;
      let base = pp.lhFixed
        ? (lineH - size * LINE) / 2 + size * ASC
        : size * ASC * (pp.lhPct || 1);
      if (imgH > base) {
        lineH += imgH - base;
        base = imgH;
      }
      const tail = line.atoms[line.atoms.length - 1];
      const content = tail ? tail.x + tail.w - line.start : 0;
      const avail = right - line.start;
      let shiftX = 0;
      let extra = 0;
      if (pp.align === 'center') shiftX = Math.max(0, (avail - content) / 2);
      else if (pp.align === 'right') shiftX = Math.max(0, avail - content);
      else if (pp.align === 'justify' && !last && !line.broke) {
        const gaps = line.atoms.slice(0, -1).filter((a) => a.sw > 0).length;
        if (gaps) extra = Math.max(0, (avail - content) / gaps);
      }
      const ops = [];
      if (pp.bg)
        ops.push({
          t: 'rect',
          x: ml,
          y: 0,
          w: right - ml,
          h: lineH,
          color: pp.bg,
        });
      if (line.label)
        ops.push({
          t: 'text',
          x: line.label.x,
          y: base - rise(line.label.st),
          s: line.label.text,
          st: line.label.st,
        });
      let run = null;
      const flush = () => {
        if (!run) return;
        const y = base - rise(run.st);
        ops.push({ t: 'text', x: run.x, y, s: run.s, st: run.st });
        const stroke = Math.max(0.5, eff(run.st) * 0.06);
        if (run.st.underline)
          ops.push({
            t: 'line',
            x1: run.x,
            y1: y + eff(run.st) * 0.12,
            x2: run.x + run.w,
            y2: y + eff(run.st) * 0.12,
            w: stroke,
            color: run.st.color,
          });
        if (run.st.strike)
          ops.push({
            t: 'line',
            x1: run.x,
            y1: y - eff(run.st) * 0.28,
            x2: run.x + run.w,
            y2: y - eff(run.st) * 0.28,
            w: stroke,
            color: run.st.color,
          });
        run = null;
      };
      let offset = 0;
      line.atoms.forEach((a, k) => {
        const x = a.x + shiftX + offset;
        if (extra && a.sw > 0 && k < line.atoms.length - 1) offset += extra;
        if (a.img) {
          flush();
          ops.push({ t: 'img', x, y: base - a.h, w: a.w, h: a.h, img: a.img });
          return;
        }
        if (a.tab || !a.text) {
          flush();
          return;
        }
        const end = k === line.atoms.length - 1;
        const s = end ? a.word : a.text;
        const w = end ? a.w : a.w + a.sw;
        if (!s) return;
        if (a.st.bg)
          ops.push({
            t: 'rect',
            x,
            y: base - rise(a.st) - eff(a.st) * ASC,
            w,
            h: eff(a.st) * (ASC + DESC),
            color: a.st.bg,
          });
        if (
          run &&
          run.st === a.st &&
          !extra &&
          Math.abs(run.x + run.w - x) < 0.01
        ) {
          run.s += s;
          run.w += w;
        } else {
          flush();
          run = { x, s, w, st: a.st };
        }
      });
      flush();
      return {
        h: lineH,
        ops,
        before: n === 0 ? pp.mt : 0,
        after: last ? pp.mb : 0,
        breakBefore: n === 0 && pp.breakBefore,
        breakAfter: last && pp.breakAfter,
        group,
        keepStart: n === 0 && pp.keepNext,
      };
    });
  }
  table(t, width) {
    const n = Math.max(
      1,
      t.columns.length,
      ...t.rows.map((r) =>
        r.cells.reduce((s, c) => s + (c.covered ? 1 : c.span), 0),
      ),
    );
    const cols = Array.from({ length: n }, (_, i) => t.columns[i] || {});
    const avail = Math.max(40, width - Math.max(0, t.ml));
    let widths = cols.every((c) => c.abs > 0)
      ? cols.map((c) => c.abs)
      : cols.every((c) => c.rel > 0)
        ? cols.map((c) => c.rel)
        : cols.map(() => 1);
    const sum = widths.reduce((a, b) => a + b, 0);
    const natural = cols.every((c) => c.abs > 0) ? sum : avail;
    const tableW = Math.min(t.width || natural, avail);
    widths = widths.map((w) => (w / sum) * tableW);
    const x0 =
      t.align === 'center'
        ? (width - tableW) / 2
        : t.align === 'right'
          ? width - tableW
          : Math.max(0, Math.min(t.ml, width - tableW));
    const xs = [];
    widths.reduce((x, w, i) => ((xs[i] = x), x + w), x0);
    const header = [];
    const body = [];
    t.rows.forEach((row, r) => {
      const cells = [];
      let ci = 0;
      for (const cell of row.cells) {
        if (ci >= n) break;
        if (cell.covered) {
          ci++;
          continue;
        }
        const span = Math.min(cell.span, n - ci);
        const w = widths.slice(ci, ci + span).reduce((a, b) => a + b, 0);
        const cp = cell.props;
        const pad = (side) =>
          toPt(cp[`fo:padding-${side}`]) ?? toPt(cp['fo:padding']) ?? 2.85;
        const border = (side) =>
          parseBorder(cp[`fo:border-${side}`] ?? cp['fo:border']);
        const c = {
          x: xs[ci],
          w,
          pl: pad('left'),
          pr: pad('right'),
          pt: pad('top'),
          pb: pad('bottom'),
          bg: color(cp['fo:background-color']),
          borders: {
            top: border('top'),
            bottom: border('bottom'),
            left: border('left'),
            right: border('right'),
          },
          valign: cp['style:vertical-align'] || 'top',
        };
        c.units = this.blocks(cell.blocks, Math.max(10, w - c.pl - c.pr));
        cells.push(c);
        ci += span;
      }
      const unit = rowUnit(cells, row.minH, 0);
      unit.before = r === 0 ? t.mt : 0;
      unit.after = r === t.rows.length - 1 ? t.mb : 0;
      unit.breakBefore = r === 0 && t.breakBefore;
      if (row.header) header.push(unit);
      else body.push(unit);
    });
    for (const u of body) u.header = header;
    return [...header, ...body];
  }
}

// One table row. With `limit`, builds the part of the row that fits (page splits).
function rowUnit(cells, minH, limit) {
  const parts = cells.map((c) => {
    if (!limit) return { take: c.units, rest: [] };
    const room = limit - c.pt - c.pb;
    let h = 0;
    let k = 0;
    while (k < c.units.length) {
      const add = gapBetween(c.units, k) + c.units[k].h;
      if (h + add > room) break;
      h += add;
      k++;
    }
    return { take: c.units.slice(0, k), rest: c.units.slice(k) };
  });
  const rowH = Math.max(
    limit ? 0 : minH,
    4,
    ...parts.map((p, i) => stackHeight(p.take) + cells[i].pt + cells[i].pb),
  );
  const ops = [];
  cells.forEach((c, i) => {
    if (c.bg)
      ops.push({ t: 'rect', x: c.x, y: 0, w: c.w, h: rowH, color: c.bg });
    const take = parts[i].take;
    const ch = stackHeight(take);
    let y = c.pt;
    if (!limit && c.valign === 'middle') y += (rowH - c.pt - c.pb - ch) / 2;
    else if (!limit && c.valign === 'bottom') y += rowH - c.pt - c.pb - ch;
    take.forEach((u, k) => {
      y += gapBetween(take, k);
      for (const op of u.ops) ops.push(shift(op, c.x + c.pl, y));
      y += u.h;
    });
    const b = c.borders;
    const edge = (x1, y1, x2, y2, s) =>
      s && ops.push({ t: 'line', x1, y1, x2, y2, w: s.w, color: s.color });
    edge(c.x, 0, c.x + c.w, 0, b.top);
    edge(c.x, rowH, c.x + c.w, rowH, b.bottom);
    edge(c.x, 0, c.x, rowH, b.left);
    edge(c.x + c.w, 0, c.x + c.w, rowH, b.right);
  });
  const unit = { h: rowH, ops, before: 0, after: 0 };
  unit.split = (avail) => {
    const piece = rowUnit(cells, 0, avail);
    if (!piece.parts.some((p) => p.take.length)) return null;
    const restCells = cells.map((c, i) => ({
      ...c,
      units: piece.parts[i].rest,
    }));
    if (restCells.every((c) => !c.units.length)) return [piece, null];
    return [piece, rowUnit(restCells, 0, 0)];
  };
  unit.parts = parts;
  return unit;
}

/**
 * Lays the model out into pages of drawing operations (points, top-left origin).
 * `measure` = { width(text, style) → points, ansi: boolean }.
 */
export function paginate(model, measure) {
  const L = new Layout(measure, model);
  const { page } = model;
  const contentW = page.width - page.left - page.right;
  L.fields = { page: 88, pages: 88 };
  const areaH = (blocks, area) =>
    blocks
      ? Math.min(
          page.height * 0.3,
          Math.max(area.minH, stackHeight(L.blocks(blocks, contentW))) +
            area.gap,
        )
      : 0;
  const headerH = areaH(model.header, page.header);
  const footerH = areaH(model.footer, page.footer);
  const bodyTop = page.top + headerH;
  const bodyH = Math.max(72, page.height - bodyTop - page.bottom - footerH);
  model.bodyH = bodyH;
  const units = L.blocks(model.blocks, contentW);
  const pages = [];
  let items = [];
  let y = 0;
  let prevAfter = 0;
  const newPage = () => {
    pages.push(items);
    items = [];
    y = 0;
    prevAfter = 0;
  };
  const place = (u, gap) => {
    items.push({ y: y + gap, ops: u.ops });
    y += gap + u.h;
    prevAfter = u.after;
  };
  // Repeated table header rows at the top of a continuation page.
  const header = (u) => u.header && u.header.forEach((h) => place(h, 0));
  for (const original of units) {
    let u = original;
    if (u.breakBefore && items.length) newPage();
    // Like LibreOffice, a paragraph's top spacing also applies at the top of a page.
    let gap = (items.length ? prevAfter : 0) + u.before;
    if (
      u.keepH &&
      items.length &&
      u.keepH <= bodyH &&
      y + gap + u.keepH > bodyH + 0.01
    ) {
      newPage();
      gap = u.before;
    }
    for (let guard = 0; u && guard < 20000; guard++) {
      if (y + gap + u.h <= bodyH + 0.01) {
        place(u, gap);
        break;
      }
      const room = bodyH - y - gap;
      const parts =
        u.split && (room > 18 || !items.length)
          ? u.split(items.length ? room : bodyH)
          : null;
      if (parts) {
        place(parts[0], items.length ? gap : 0);
        newPage();
        u = parts[1];
        if (u) {
          u.header = original.header;
          header(original);
        }
        gap = 0;
        continue;
      }
      if (items.length) {
        newPage();
        header(original);
        gap = items.length ? 0 : u.before;
        continue;
      }
      model.warnings.add('clipped');
      place(u, 0);
      break;
    }
    if (original.breakAfter) newPage();
  }
  if (items.length || !pages.length) pages.push(items);
  const total = pages.length;
  // Headers and footers are laid out per page so page-number fields are right.
  const stamp = (ops, blocks, top) => {
    const us = L.blocks(blocks, contentW);
    let yy =
      top === undefined ? page.height - page.bottom - stackHeight(us) : top;
    us.forEach((u, k) => {
      yy += gapBetween(us, k);
      for (const op of u.ops) ops.push(shift(op, page.left, yy));
      yy += u.h;
    });
  };
  return pages.map((list, i) => {
    const ops = [];
    for (const it of list)
      for (const op of it.ops) ops.push(shift(op, page.left, bodyTop + it.y));
    L.fields = { page: i + 1, pages: total };
    if (model.header) stamp(ops, model.header, page.top);
    if (model.footer) stamp(ops, model.footer);
    return ops;
  });
}

// ---------------------------------------------------------------- output

// Built-in PDF fonts per family: regular, bold, italic, bold italic.
const standardFonts = (F) => ({
  sans: [
    F.Helvetica,
    F.HelveticaBold,
    F.HelveticaOblique,
    F.HelveticaBoldOblique,
  ],
  serif: [
    F.TimesRoman,
    F.TimesRomanBold,
    F.TimesRomanItalic,
    F.TimesRomanBoldItalic,
  ],
  mono: [F.Courier, F.CourierBold, F.CourierOblique, F.CourierBoldOblique],
});
const fontSlot = (st) => (st.bold ? 1 : 0) + (st.italic ? 2 : 0);
const ansiOnly = (s) => {
  let out = '';
  for (const ch of s) out += winAnsi(ch.codePointAt(0)) ? ch : '?';
  return out;
};

/**
 * Converts ODT bytes to PDF bytes.
 * - pageSize: 'document' (default) | 'a4' | 'letter'
 * - canvas: { measure(text, style), paint(ops, page) → Promise<Uint8Array PNG> }
 *   (browser). Used only when the text needs fonts beyond the built-in PDF fonts.
 * - decodeImage(bytes, mime) → Promise<Uint8Array PNG | null> for GIF/BMP/WebP/SVG.
 * - onPage(done, total) progress callback.
 */
export async function convertODT(bytes, options = {}) {
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
  const STANDARD = standardFonts(StandardFonts);
  const parts = readODT(bytes);
  const model = buildDocument(parts, options);
  const fits = fitsWinAnsi(model);
  const mode = fits || !options.canvas ? 'text' : 'image';
  if (!fits && mode === 'text') model.warnings.add('replaced-characters');
  const doc = await PDFDocument.create();
  doc.setTitle(model.title || options.title || 'document');
  doc.setCreator('KittySuite');
  doc.setProducer('KittySuite');
  const fonts = new Map();
  const font = (st) => {
    const name = (STANDARD[st.kind] || STANDARD.sans)[fontSlot(st)];
    if (!fonts.has(name)) fonts.set(name, doc.embedStandardFont(name));
    return fonts.get(name);
  };
  const widths = new Map();
  const measure =
    mode === 'text'
      ? {
          ansi: true,
          width(text, st) {
            const key = `${st.kind}${fontSlot(st)}|${eff(st)}|${text}`;
            let w = widths.get(key);
            if (w === undefined) {
              w = font(st).widthOfTextAtSize(ansiOnly(text), eff(st));
              widths.set(key, w);
            }
            return w;
          },
        }
      : { ansi: false, width: (text, st) => options.canvas.measure(text, st) };
  const pages = paginate(model, measure);
  const { width: W, height: H } = model.page;
  const hex = (value) => {
    const n = parseInt((value || '#000000').slice(1), 16);
    return rgb(
      ((n >> 16) & 255) / 255,
      ((n >> 8) & 255) / 255,
      (n & 255) / 255,
    );
  };
  const embedded = new Map();
  const embed = async (img) => {
    if (embedded.has(img.key)) return embedded.get(img.key);
    let result = null;
    try {
      if (img.mime === 'image/png') result = await doc.embedPng(img.bytes);
      else if (img.mime === 'image/jpeg')
        result = await doc.embedJpg(img.bytes);
      else if (options.decodeImage) {
        const png = await options.decodeImage(img.bytes, img.mime);
        if (png) result = await doc.embedPng(png);
      }
    } catch {
      result = null;
    }
    if (!result) model.warnings.add('image');
    embedded.set(img.key, result);
    return result;
  };
  for (let i = 0; i < pages.length; i++) {
    const page = doc.addPage([W, H]);
    const ops = pages[i];
    if (mode === 'image') {
      // The browser paints text and shapes; pictures stay in the PDF at full quality.
      const png = await options.canvas.paint(
        ops.filter((op) => op.t !== 'img'),
        model.page,
      );
      page.drawImage(await doc.embedPng(png), {
        x: 0,
        y: 0,
        width: W,
        height: H,
      });
    }
    for (const op of ops) {
      if (op.t === 'img') {
        const image = await embed(op.img);
        if (image)
          page.drawImage(image, {
            x: op.x,
            y: H - op.y - op.h,
            width: op.w,
            height: op.h,
          });
      } else if (mode === 'image') continue;
      else if (op.t === 'text') {
        const text = ansiOnly(op.s);
        if (text.trim())
          page.drawText(text, {
            x: op.x,
            y: H - op.y,
            size: eff(op.st),
            font: font(op.st),
            color: hex(op.st.color),
          });
      } else if (op.t === 'rect')
        page.drawRectangle({
          x: op.x,
          y: H - op.y - op.h,
          width: op.w,
          height: op.h,
          color: hex(op.color),
        });
      else if (op.t === 'line')
        page.drawLine({
          start: { x: op.x1, y: H - op.y1 },
          end: { x: op.x2, y: H - op.y2 },
          thickness: op.w,
          color: hex(op.color),
        });
    }
    if (options.onPage) await options.onPage(i + 1, pages.length);
  }
  const out = await doc.save({ useObjectStreams: true });
  return {
    bytes: out,
    pages: pages.length,
    mode,
    warnings: [...model.warnings],
    title: model.title,
  };
}
