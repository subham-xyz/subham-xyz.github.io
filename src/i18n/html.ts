// Build-time translation of a rendered page. Runs only for localized URLs (see
// src/middleware.ts). English pages are never touched.
//
// Translated: text nodes, user-facing attributes, page metadata and JSON-LD strings.
// A paragraph-like element whose text runs through inline markup (links, bold) is
// translated as one sentence: "Use <0>Compress Image</0> first." so word order can
// change. Never translated: <script>/<style>/<svg>/<code>/<pre>/<textarea> contents,
// form values, and anything inside translate="no" or an element with its own lang.
import { normalize, type Translator } from './phrases.ts';

const ATTRIBUTES = ['alt', 'title', 'aria-label', 'aria-description', 'placeholder', 'data-tool-name', 'data-label'];
const META = new Set(['description', 'og:title', 'og:description', 'og:image:alt', 'twitter:title', 'twitter:description']);
const RAW = new Set(['script', 'style', 'svg', 'code', 'pre', 'textarea']);
const INLINE = new Set(['a', 'strong', 'em', 'b', 'i', 'span', 'small', 'kbd', 'abbr', 'mark', 'bdi', 'br', 'wbr']);
const VOID = new Set(['br', 'wbr', 'img', 'input', 'meta', 'link', 'hr', 'source', 'area', 'col', 'base', 'embed', 'param', 'track']);
const SENTENCE = new Set(['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'summary', 'label', 'figcaption', 'dt', 'dd', 'td', 'th', 'button', 'blockquote', 'caption', 'legend']);

const decode = (text: string) =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
const escapeText = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (text: string) => escapeText(text).replace(/"/g, '&quot;');
const escapeJson = (json: string) => json.replaceAll('<', '\\u003c');
const hasWords = (text: string) => /\p{L}{2}/u.test(text);
const tagName = (tag: string) => (tag.match(/^<\/?([a-zA-Z][\w-]*)/) || [])[1]?.toLowerCase();
const isClosing = (tag: string) => tag.startsWith('</');
const selfClosing = (tag: string, name?: string) => tag.endsWith('/>') || (name ? VOID.has(name) : false);
/** Elements whose content is in a fixed language or must stay as written. */
const optedOut = (tag: string, name?: string) =>
  /\stranslate="no"/.test(tag) || (name !== 'html' && /\slang="/.test(tag));

export type Missing = Set<string>;
type Localize = (href: string) => string;

function translateValue(value: string, t: Translator, missing?: Missing) {
  const text = normalize(decode(value));
  if (!hasWords(text)) return undefined;
  const result = t.translate(text);
  if (result === undefined) missing?.add(text);
  return result;
}

const SCHEMA_KEEP = new Set(['url', 'item', 'logo', 'urlTemplate', 'target', 'query-input', 'priceCurrency', 'price', 'operatingSystem', 'applicationCategory', 'inLanguage']);
function translateJson(value: unknown, t: Translator, missing?: Missing): unknown {
  if (typeof value === 'string') {
    if (/^(https?:)?\/\//.test(value) || !hasWords(value)) return value;
    const text = normalize(value);
    const result = t.translate(text);
    if (result === undefined && / /.test(text)) missing?.add(text);
    return result ?? value;
  }
  if (Array.isArray(value)) return value.map((item) => translateJson(item, t, missing));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) =>
        key.startsWith('@') || SCHEMA_KEEP.has(key) ? [key, item] : [key, translateJson(item, t, missing)],
      ),
    );
  return value;
}

function translateTag(tag: string, t: Translator, localize: Localize, missing?: Missing) {
  if (isClosing(tag) || tag.startsWith('<!')) return tag;
  let out = tag.replace(/\s(href|action)="([^"]*)"/g, (whole, name, value) => {
    const href = decode(value);
    return href.startsWith('/') && !href.startsWith('//') ? ` ${name}="${escapeAttr(localize(href))}"` : whole;
  });
  for (const name of ATTRIBUTES)
    out = out.replace(new RegExp(`\\s${name}="([^"]*)"`), (whole, value) => {
      const translated = translateValue(value, t, missing);
      return translated === undefined ? whole : ` ${name}="${escapeAttr(translated)}"`;
    });
  if (/^<meta\b/.test(out)) {
    const kind = (out.match(/\s(?:name|property)="([^"]*)"/) || [])[1];
    if (kind && META.has(kind))
      out = out.replace(/\scontent="([^"]*)"/, (whole, value) => {
        const translated = translateValue(value, t, missing);
        return translated === undefined ? whole : ` content="${escapeAttr(translated)}"`;
      });
  }
  return out;
}

/** Index of the token closing the element opened at `start`. */
function matchingClose(tokens: string[], start: number, name: string) {
  let depth = 0;
  for (let i = start; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token.startsWith('<') || token.startsWith('<!--') || tagName(token) !== name) continue;
    if (isClosing(token)) depth--;
    else if (!selfClosing(token, name)) depth++;
    if (depth === 0) return i;
  }
  return -1;
}

/**
 * When an element's content is text plus inline markup with words inside it, return
 * the sentence key, e.g. "Try <0>Compress PDF</0> next.", and the inline tags by slot.
 */
function sentence(tokens: string[], start: number, end: number) {
  const tags: string[] = [];
  const stack: number[] = [];
  let key = '';
  let innerWords = false;
  let outerWords = false;
  for (let i = start + 1; i < end; i++) {
    const token = tokens[i];
    if (token.startsWith('<!--')) continue;
    if (token.startsWith('<')) {
      const name = tagName(token);
      if (!name || !INLINE.has(name) || optedOut(token, name)) return undefined;
      if (isClosing(token)) {
        const slot = stack.pop();
        if (slot === undefined) return undefined;
        key += `</${slot}>`;
      } else if (selfClosing(token, name)) {
        key += `<${tags.push(token) - 1}/>`;
      } else {
        const slot = tags.push(token) - 1;
        stack.push(slot);
        key += `<${slot}>`;
      }
      continue;
    }
    const text = decode(token);
    if (hasWords(text)) {
      if (stack.length) innerWords = true;
      else outerWords = true;
    }
    key += text;
  }
  if (stack.length || !innerWords || !outerWords) return undefined;
  return { key: normalize(key), tags };
}

/** Rebuild a translated sentence, putting the original inline tags back. */
function rebuild(translation: string, tags: string[], t: Translator, localize: Localize, missing?: Missing) {
  const used = new Set<number>();
  let out = '';
  const open: string[] = [];
  for (const part of translation.split(/(<\/?\d+\/?>)/)) {
    const slot = part.match(/^<(\/?)(\d+)(\/?)>$/);
    if (!slot) {
      out += escapeText(part);
      continue;
    }
    const index = Number(slot[2]);
    const tag = tags[index];
    if (tag === undefined) return undefined;
    if (slot[1]) {
      const name = open.pop();
      if (!name) return undefined;
      out += `</${name}>`;
    } else {
      used.add(index);
      out += translateTag(tag, t, localize, missing);
      if (!slot[3] && !selfClosing(tag, tagName(tag))) open.push(tagName(tag)!);
    }
  }
  return open.length || used.size !== tags.length ? undefined : out;
}

/**
 * Translate a full HTML document. `localize` maps an internal English path to the
 * localized URL. Untranslated strings are collected in `missing` when provided.
 */
export function translateHtml(html: string, t: Translator, localize: Localize, missing?: Missing) {
  const tokens = html.match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g) || [];
  let out = '';
  // Inside a sentence that has its own (missing) key, its pieces are not reported.
  let quietUntil = -1;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const report = i > quietUntil ? missing : undefined;
    if (token.startsWith('<!--')) {
      out += token;
      continue;
    }
    if (token.startsWith('<')) {
      const name = tagName(token);
      if (!name || isClosing(token)) {
        out += token;
        continue;
      }
      const end = selfClosing(token, name) ? i : matchingClose(tokens, i, name);
      if (optedOut(token, name) && end > i) {
        out += tokens.slice(i, end + 1).join('');
        i = end;
        continue;
      }
      if (RAW.has(name) && end > i) {
        const body = tokens.slice(i + 1, end).join('');
        let inner = body;
        if (name === 'script' && /type="application\/ld\+json"/.test(token))
          try {
            inner = escapeJson(JSON.stringify(translateJson(JSON.parse(body), t, missing)));
          } catch {
            inner = body;
          }
        out += translateTag(token, t, localize, missing) + inner + tokens[end];
        i = end;
        continue;
      }
      if (SENTENCE.has(name) && end > i) {
        const unit = sentence(tokens, i, end);
        if (unit) {
          const translated = t.translate(unit.key);
          const rebuilt = translated === undefined ? undefined : rebuild(translated, unit.tags, t, localize, missing);
          if (rebuilt !== undefined) {
            const lead = decode(tokens[i + 1] || '').match(/^\s*/)?.[0] || '';
            out += translateTag(token, t, localize, missing) + lead + rebuilt + tokens[end];
            i = end;
            continue;
          }
          report?.add(unit.key);
          quietUntil = end;
          // No sentence translation: fall through and translate piece by piece.
        }
      }
      out += translateTag(token, t, localize, missing);
      continue;
    }
    const decoded = decode(token);
    if (!hasWords(decoded)) {
      out += token;
      continue;
    }
    const translated = t.translateText(decoded);
    if (translated === undefined) {
      report?.add(normalize(decoded));
      out += token;
    } else out += escapeText(translated);
  }
  return out;
}
