import {
  silhouette,
  score,
  segmentGlyphs,
  alignGlyphs,
  detectStyle,
} from './font-score.mjs';
import { gunzipSync } from 'fflate';
type Font = {
  id: string;
  name: string;
  url: string;
  license: string;
  source: string;
  licenseName: string;
  weightRange: string;
};
type Style = 'regular' | 'bold' | 'italic';
type StyleEntry = { font: number; id: string; url: string; weight: number };
type Manifest = {
  fonts: Font[];
  characters: string;
  stride: number;
  styles?: Partial<Record<Exclude<Style, 'regular'>, StyleEntry[]>>;
};
// One searchable font file: a family in one style, with its glyph records.
type Entry = {
  family: Font;
  style: Style;
  id: string;
  url: string;
  weight: number;
  view: DataView;
  row: number;
};
async function glyphData(url: string, rows: number, manifest: Manifest) {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(
      'Font index could not load. Try again when the site connection is available.',
    );
  const raw = new Uint8Array(await response.arrayBuffer());
  const bytes = raw[0] === 31 && raw[1] === 139 ? gunzipSync(raw) : raw;
  if (bytes.length !== rows * manifest.characters.length * manifest.stride)
    throw new Error('The font index is incomplete. Reload and try again.');
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
let indexPromise: Promise<Manifest & { data: DataView }> | undefined;
function index() {
  return (indexPromise ||= fetch('/font-index/manifest.json')
    .then((r) => {
      if (!r.ok)
        throw new Error(
          'Font index could not load. Try again when the site connection is available.',
        );
      return r.json() as Promise<Manifest>;
    })
    .then(async (manifest) => ({
      ...manifest,
      data: await glyphData(
        '/font-index/glyphs.bin.gz',
        manifest.fonts.length,
        manifest,
      ),
    }))
    .catch((error) => {
      indexPromise = undefined;
      throw error;
    }));
}
// Bold and italic indexes are downloaded only when the crop looks bold or italic.
const styleData = new Map<string, Promise<DataView>>();
function styleIndex(data: Index, style: 'bold' | 'italic') {
  const rows = data.styles?.[style]?.length || 0;
  if (!styleData.has(style))
    styleData.set(
      style,
      glyphData(`/font-index/glyphs-${style}.bin.gz`, rows, data).catch(
        (error) => {
          styleData.delete(style);
          throw error;
        },
      ),
    );
  return styleData.get(style)!;
}
async function entries(data: Index, styles: Style[]): Promise<Entry[]> {
  const list: Entry[] = data.fonts.map((family, row) => ({
    family,
    style: 'regular',
    id: family.id,
    url: family.url,
    weight: 400,
    view: data.data,
    row,
  }));
  for (const style of styles) {
    if (style === 'regular' || !data.styles?.[style]?.length) continue;
    const view = await styleIndex(data, style);
    data.styles[style]!.forEach((e, row) =>
      list.push({
        family: data.fonts[e.font],
        style,
        id: e.id,
        url: e.url,
        weight: e.weight,
        view,
        row,
      }),
    );
  }
  return list;
}
// Thresholds measured on the indexed collection (see tests/font-benchmark.mjs).
const ITALIC_SLANT = 6;
const BOLD_STROKE = 0.18;
function stylesFor(cues: { slant: number; stroke: number }): Style[] {
  const styles: Style[] = ['regular'];
  if (cues.slant >= ITALIC_SLANT) styles.push('italic');
  if (cues.stroke >= BOLD_STROKE) styles.push('bold');
  return styles;
}
type Index = Manifest & { data: DataView };
type Prepared = ReturnType<typeof segmentGlyphs>;
type Pair = { char: string; glyph: { values: Uint8Array; aspect: number } };
// Typical advance width of each character across the whole collection (median), used
// only to pair typed letters with detected glyph boxes.
let medians: Map<string, number> | undefined;
function expectedWidths(data: Index) {
  if (medians) return medians;
  medians = new Map();
  [...data.characters].forEach((char, ci) => {
    const widths = data.fonts
      .map((_, fi) =>
        data.data.getFloat32(
          (fi * data.characters.length + ci) * data.stride + 196,
          true,
        ),
      )
      .filter((w) => w > 0)
      .sort((a, b) => a - b);
    medians!.set(char, widths[Math.floor(widths.length / 2)] || 0.5);
  });
  return medians;
}
// Shape difference on the 12 × 16 grid and on a 6 × 8 version of it. The coarse grid
// tolerates blur, small text and compression, which shift strokes by a cell or so.
function shapeDifference(values: Uint8Array, index: DataView, offset: number) {
  let fine = 0,
    coarse = 0;
  for (let y = 0; y < 16; y += 2)
    for (let x = 0; x < 12; x += 2) {
      let a = 0,
        b = 0;
      for (const p of [
        y * 12 + x,
        y * 12 + x + 1,
        (y + 1) * 12 + x,
        (y + 1) * 12 + x + 1,
      ]) {
        const u = values[p],
          v = index.getUint8(offset + p);
        fine += Math.abs(u - v);
        a += u;
        b += v;
      }
      coarse += Math.abs(a - b) / 4;
    }
  return (fine / 192 + (COARSE * coarse) / 48) / (255 * (1 + COARSE));
}
const COARSE = 1;
const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] || 1;
type Layout = { heights: number[]; tops: number[] };
// Letter heights and tops relative to the median letter height. Comparing these with each
// font tells x-height, cap-height and ascender proportions apart, which shapes alone cannot.
function userLayout(pairs: Pair[]): Layout {
  const boxes = pairs.map(
    (p) => p.glyph as unknown as { y: number; height: number },
  );
  const unit = median(boxes.map((b) => b.height));
  const baseline = median(boxes.map((b) => b.y + b.height));
  return {
    heights: boxes.map((b) => b.height / unit),
    tops: boxes.map((b) => (baseline - b.y) / unit),
  };
}
function layoutDifference(user: Layout, heights: number[], tops: number[]) {
  const unit = median(heights);
  let total = 0;
  for (let i = 0; i < heights.length; i++)
    total +=
      Math.abs(Math.log((user.heights[i] || 1) / (heights[i] / unit || 1))) +
      Math.abs(user.tops[i] - tops[i] / unit) / 2;
  return total / Math.max(1, heights.length);
}
const LAYOUT_WEIGHT = 0.6;
// Average shape difference between the paired glyphs and this font, plus letter proportions.
function glyphScore(data: Index, entry: Entry, pairs: Pair[], layout: Layout) {
  let total = 0;
  const heights: number[] = [],
    tops: number[] = [];
  for (const { char, glyph } of pairs) {
    const view = entry.view;
    const offset =
      (entry.row * data.characters.length +
        Math.max(0, data.characters.indexOf(char))) *
      data.stride;
    const aspect = view.getFloat32(offset + 192, true);
    total +=
      shapeDifference(glyph.values, view, offset) +
      0.18 * Math.abs(Math.log(glyph.aspect / aspect));
    heights.push(view.getFloat32(offset + 200, true));
    tops.push(view.getFloat32(offset + 204, true));
  }
  const proportions =
    pairs.length > 2
      ? LAYOUT_WEIGHT * layoutDifference(layout, heights, tops)
      : 0;
  return total / Math.max(1, pairs.length) + proportions;
}
// Gaps between neighbouring glyphs, relative to glyph height.
const gaps = (glyphs: any[]) =>
  glyphs
    .slice(1)
    .map(
      (g: any, j: number) =>
        (g.x - glyphs[j].x - glyphs[j].width) / Math.max(1, g.height),
    );
function spacingDifference(a: number[], b: number[]) {
  if (a.length !== b.length || !a.length) return 1;
  return a.reduce((n, g, j) => n + Math.abs(g - b[j]), 0) / a.length;
}
// Draws the sample text in one weight and returns its image and silhouette.
function renderSample(
  ctx: OffscreenCanvasRenderingContext2D,
  family: string,
  weight: number,
  text: string,
) {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.font = `${weight} 80px "${family}"`;
  ctx.textBaseline = 'alphabetic';
  const scale = Math.min(1, 2350 / ctx.measureText(text).width);
  ctx.save();
  ctx.scale(scale, 1);
  ctx.fillStyle = '#000';
  ctx.fillText(text, 12, 130);
  ctx.restore();
  const image = ctx.getImageData(0, 0, width, height),
    sample = silhouette(image);
  sample.aspect /= scale;
  return { image, sample };
}
function compareWeights(
  ctx: OffscreenCanvasRenderingContext2D,
  family: string,
  text: string,
  target: any,
  prepared: Prepared,
  weights: number[],
) {
  let best = Infinity,
    weight = 400,
    proportion = 0,
    spacing = 0;
  for (const w of weights) {
    const { image, sample } = renderSample(ctx, family, w, text);
    const value = score(target, sample);
    if (value >= best) continue;
    best = value;
    weight = w;
    proportion = Math.abs(Math.log(target.aspect / sample.aspect));
    spacing = spacingDifference(
      gaps(prepared.glyphs),
      gaps(segmentGlyphs(image).glyphs),
    );
  }
  return { score: best, weight, proportion, spacing };
}
// Fonts re-rendered and compared as a whole line after the per-glyph shortlist.
const SHORTLIST = 30;
self.onmessage = async (event) => {
  let canvas: OffscreenCanvas | undefined;
  const loaded: FontFace[] = [];
  try {
    if (!('OffscreenCanvas' in self) || !('fonts' in self))
      throw new Error(
        'Local font matching needs OffscreenCanvas and worker fonts. Try a current Chromium browser.',
      );
    self.postMessage({ progress: 'Loading the local glyph index…' });
    const data = await index(),
      { image, text } = event.data;
    const target = silhouette(image),
      prepared = segmentGlyphs(image, event.data.sensitivity ?? 0.5);
    const letters = [...text.replace(/\s/g, '')];
    const widths = expectedWidths(data);
    const pairs = (
      alignGlyphs(
        prepared,
        letters,
        (c: string) => widths.get(c) || 0.5,
      ) as Pair[]
    ).filter((p) => data.characters.includes(p.char));
    // Joined scripts can leave too few separate glyphs; fall back to pairing them in order.
    if (pairs.length < 2)
      pairs.splice(
        0,
        pairs.length,
        ...prepared.glyphs
          .slice(0, letters.length)
          .map((glyph, i) => ({ char: letters[i], glyph }) as Pair)
          .filter((p) => data.characters.includes(p.char)),
      );
    const layout = userLayout(pairs);
    if (!pairs.length)
      throw new Error(
        'No clear glyphs found. Tighten the crop or adjust the ink sensitivity.',
      );
    const cues = detectStyle(prepared);
    const styles = stylesFor(cues);
    if (styles.length > 1)
      self.postMessage({ progress: 'Loading bold and italic styles…' });
    const searchable = await entries(data, styles);
    const ranked = searchable
      .map((entry) => ({
        entry,
        glyphScore: glyphScore(data, entry, pairs, layout),
      }))
      .sort((a, b) => a.glyphScore - b.glyphScore);
    const scored = ranked.slice(0, SHORTLIST);
    canvas = new OffscreenCanvas(2400, 200);
    const ctx = canvas.getContext('2d')!;
    const results = [];
    for (let i = 0; i < scored.length; i++) {
      const { entry, glyphScore: shapeScore } = scored[i];
      self.postMessage({
        progress: `Rendering candidate ${i + 1} of ${scored.length} from ${searchable.length} font styles…`,
      });
      const family = 'KittyMatch-' + entry.id,
        face = new FontFace(family, `url(${entry.url})`);
      await face.load();
      (self as any).fonts.add(face);
      loaded.push(face);
      // Regular files are also tried with synthetic bold; real bold/italic files as they are.
      const weights = entry.style === 'regular' ? [400, 700] : [400];
      const compared = compareWeights(
        ctx,
        family,
        text,
        target,
        prepared,
        weights,
      );
      results.push({
        ...entry.family,
        id: entry.id,
        url: entry.url,
        name:
          entry.family.name +
          (entry.style === 'regular'
            ? ''
            : entry.style === 'bold'
              ? ' Bold'
              : ' Italic'),
        style: entry.style,
        glyphScore: shapeScore,
        ...compared,
        weight: entry.style === 'regular' ? compared.weight : entry.weight,
      });
    }
    // One suggestion per family: keep its best-scoring style.
    const seen = new Set<string>();
    const unique = results
      .sort((a, b) => a.score - b.score)
      .filter((r) => !seen.has(r.source) && seen.add(r.source));
    self.postMessage({
      results: unique.slice(0, 6),
      familyCount: data.fonts.length,
      styles,
      segmented: prepared.glyphs.length,
    });
  } catch (error) {
    self.postMessage({ error: (error as Error).message });
  } finally {
    if (canvas) canvas.width = canvas.height = 0;
    for (const face of loaded) (self as any).fonts.delete(face);
  }
};
