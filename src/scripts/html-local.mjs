// Construct a new, tightly allowlisted tree; untrusted nodes never enter the live document.
const ALLOWED_TAGS = new Set([
  'div',
  'p',
  'span',
  'h1',
  'h2',
  'h3',
  'h4',
  'strong',
  'em',
  'b',
  'i',
  'u',
  'br',
  'hr',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th',
  'blockquote',
  'pre',
  'code',
]);
const ALLOWED_STYLES = new Set([
  'color',
  'background-color',
  'font-size',
  'font-weight',
  'font-style',
  'text-align',
  'padding',
  'margin',
  'border',
  'border-radius',
  'line-height',
  'letter-spacing',
  'width',
  'height',
  'display',
  'white-space',
]);

// Keeps only allowlisted CSS properties with plain values (no URLs, variables or functions that load content).
function safeStyle(style) {
  const kept = [];
  for (const item of (style || '').split(';')) {
    const colon = item.indexOf(':');
    const name = item.slice(0, colon).trim().toLowerCase(),
      value = item.slice(colon + 1).trim();
    const plain = value.length < 100 && /^[a-zA-Z0-9#%.,() +-]*$/.test(value);
    if (
      ALLOWED_STYLES.has(name) &&
      plain &&
      !/(url|expression|var|image|attr)/i.test(value)
    )
      kept.push(`${name}:${value}`);
  }
  return kept.join(';');
}

function copyNode(source, parent, depth = 0) {
  if (depth > 30) return;
  if (source.nodeType === Node.TEXT_NODE) {
    parent.append(document.createTextNode(source.textContent));
    return;
  }
  if (
    source.nodeType !== Node.ELEMENT_NODE ||
    !ALLOWED_TAGS.has(source.localName)
  )
    return;
  const el = document.createElement(source.localName);
  const style = safeStyle(source.getAttribute('style'));
  if (style) el.setAttribute('style', style);
  for (const child of source.childNodes) copyNode(child, el, depth + 1);
  parent.append(el);
}

export function sanitizeHTML(value) {
  if (value.length > 200000)
    throw new Error('Use an HTML fragment under 200,000 characters.');
  const template = document.createElement('template');
  template.innerHTML = value;
  const target = document.createElement('div');
  target.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  for (const node of template.content.childNodes) copyNode(node, target);
  return new XMLSerializer().serializeToString(target);
}

const validCanvas = (width, height) =>
  Number.isInteger(width) &&
  Number.isInteger(height) &&
  width >= 100 &&
  height >= 100 &&
  width <= 2400 &&
  height <= 4000 &&
  width * height <= 8000000;

export async function renderHTML(value, width, height) {
  if (!validCanvas(width, height))
    throw new Error(
      'Choose a canvas from 100 to 2400 px wide and 100 to 4000 px high, up to 8 megapixels.',
    );
  const content = sanitizeHTML(value);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:sans-serif;color:#18292d;background:white;padding:24px;box-sizing:border-box;width:100%;height:100%;overflow:hidden">${content}</div></foreignObject></svg>`;
  const image = new Image();
  image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  try {
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(image, 0, 0);
    return canvas;
  } catch {
    throw new Error(
      'This browser cannot render the safe HTML fragment. Try a simpler fragment or a current Chromium browser.',
    );
  } finally {
    image.removeAttribute('src');
  }
}
