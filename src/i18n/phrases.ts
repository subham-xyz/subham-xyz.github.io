// Phrase catalogues: page copy, tool interfaces and runtime messages, keyed by their
// English source text. They complement the semantic dictionaries in ./translations
// (header, footer and shared controls), which stay the source for those strings.
//
// Keys are normalised the same way everywhere:
//   - whitespace collapses to single spaces;
//   - every run of digits becomes a numbered slot, so "See all 41 tools" and
//     "See all 42 tools" share the key "See all {0} tools";
//   - runtime keys may also contain named or numbered slots for any text, e.g.
//     "Conversion complete. Your {0} image is ready to download."
// Translations must keep every {slot} from their key.
export type Catalogue = Record<string, string>;

const SLOT = /\{(\w+)\}/g;
// Existing {slots} are kept as they are; digits outside them become numbered slots.
const DIGITS = /\{\w+\}|<\/?\d+\/?>|\d+(?:[.,]\d+)*/g;

export const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

/** "Page 3 of 12" → { key: "Page {0} of {1}", values: ["3", "12"] } */
export function numberKey(text: string) {
  const values: string[] = [];
  const key = text.replace(DIGITS, (digits) =>
    /^[{<]/.test(digits) ? digits : `{${values.push(digits) - 1}}`,
  );
  return { key, values };
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(SLOT, (token, name) => values[name] ?? token);

type Pattern = { regex: RegExp; names: string[]; key: string };

export class Translator {
  private patterns: Pattern[] = [];
  private catalogue: Catalogue;
  constructor(catalogue: Catalogue) {
    this.catalogue = catalogue;
    for (const key of Object.keys(catalogue)) {
      // Keys with non-numeric slots need a pattern; purely numeric ones are found
      // by numberKey(). Escape everything except the slots.
      const names: string[] = [];
      let hasText = false;
      const source = key
        .split(SLOT)
        .map((part, index) => {
          if (index % 2) {
            names.push(part);
            hasText = true;
            // Numbered slots hold numbers; named slots can hold any text.
            return /^\d+$/.test(part) ? '(\\d+(?:[.,]\\d+)*)' : '(.+?)';
          }
          return part.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/[{}]/g, '\\$&');
        })
        .join('');
      // A key made only of slots and symbols would match almost anything.
      const letters = /\p{L}/u.test(key.replace(SLOT, ''));
      if (hasText && letters) this.patterns.push({ regex: new RegExp(`^${source}$`, 's'), names, key });
    }
    // Longer templates first: the most specific wording wins.
    this.patterns.sort((a, b) => b.key.length - a.key.length);
  }

  has(text: string) {
    return this.translate(text) !== undefined;
  }

  /** Returns the translation of an already-normalised string, or undefined. */
  translate(text: string, depth = 0): string | undefined {
    if (!text) return undefined;
    const direct = this.catalogue[text];
    if (direct) return direct;
    const { key, values } = numberKey(text);
    const numbered = values.length ? this.catalogue[key] : undefined;
    if (numbered) return fill(numbered, Object.fromEntries(values.map((v, i) => [String(i), v])));
    if (depth > 2) return undefined;
    const viaPattern = this.matchPattern(text, depth);
    if (viaPattern !== undefined) return viaPattern;
    if (depth > 1) return undefined;
    if (depth > 0) return this.compound(text, ' ', /(?<=[.!?…])\s+(?=\S)/, depth + 1);
    // Summaries like "Page 1 of 2 · scan.pdf" and status lines that join two
    // messages ("2 pages ready. Review settings."): translate each part.
    return this.compound(text, ' · ', ' · ', 1) ?? this.compound(text, ' ', /(?<=[.!?…])\s+(?=\S)/, 2);
  }

  private compound(text: string, joiner: string, separator: string | RegExp, depth: number): string | undefined {
    const pieces = text.split(separator);
    if (pieces.length < 2) return undefined;
    // File names, numbers and brand words pass through unchanged.
    const fixed = (part: string) => !/\p{L}{2}/u.test(part) || !/\s/.test(part.trim()) && !this.catalogue[part] || isFixedText(numberKey(part).key);
    let translatedAny = false;
    const parts = pieces.map((part) => {
      const translated = this.translate(part, depth);
      if (translated !== undefined) {
        translatedAny = true;
        return translated;
      }
      return fixed(part) ? part : undefined;
    });
    if (!translatedAny || parts.some((part) => part === undefined)) return undefined;
    // Japanese and similar scripts do not put spaces between sentences.
    return (parts as string[]).reduce((all, part) => (all && joiner === ' ' && /[。！？]$/.test(all) ? all + part : all ? all + joiner + part : part), '');
  }

  private matchPattern(text: string, depth: number): string | undefined {
    for (const pattern of this.patterns) {
      const match = pattern.regex.exec(text);
      if (!match) continue;
      const translation = this.catalogue[pattern.key];
      if (!translation) continue;
      const captured: Record<string, string> = {};
      pattern.names.forEach((name, i) => {
        const value = match[i + 1];
        // A captured value may itself be interface text ("graphics card").
        captured[name] = this.translate(normalize(value), depth + 1) ?? value;
      });
      return fill(translation, captured);
    }
    return undefined;
  }

  /** Translate text while keeping its leading and trailing whitespace. */
  translateText(raw: string) {
    const text = normalize(raw);
    const translated = this.translate(text);
    if (translated === undefined) return undefined;
    const lead = raw.match(/^\s*/)![0];
    const trail = raw.match(/\s*$/)![0];
    return lead + translated + trail;
  }
}

// Code fragments the literal scanner can pick up.
const JUNK = /\$\{|^: |px [A-Z][a-z]+,|^circle\(|^qpdf |^Hamburgefonts$|^(Escape|Enter)$/;
// Brand, product and format names that are the same in every language.
const KEEP =
  /^(KittySuite|KittySuite\.in ↗|Loki|kitty|suite|PDF|PDF\/A|JPG|JPEG|PNG|WebP|AVIF|GIF|SVG|TIFF|BMP|ICO|HTML|EXIF|GPS|XMP|IPTC|ZIP|OCR|AES-\{0\}|Esc|Enter ↵|Ctrl|Real-ESRGAN|IS-Net|Tesseract|SIL Open Font License|Google Fonts|[A-Z]{2,5}( \/ [A-Z]{2,5})*|\{0\}( ?[×x%]| px| KB| MB)?|KB|MB|px|\{0\} × \{1\}( px)?)$/;
/** Text that is the same in every language (brands, formats, numbers) or is code. */
export const isFixedText = (text: string) => KEEP.test(text) || JUNK.test(text);
