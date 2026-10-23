import { silhouette, score, segmentGlyphs } from './font-score.mjs';
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
let indexPromise:
  | Promise<{
      fonts: Font[];
      characters: string;
      stride: number;
      data: DataView;
    }>
  | undefined;
async function index(): Promise<{
  fonts: Font[];
  characters: string;
  stride: number;
  data: DataView;
}> {
  return (indexPromise ||= Promise.all([
    fetch('/font-index/manifest.json').then((r) => {
      if (!r.ok)
        throw new Error(
          'Font index could not load. Try again when the site connection is available.',
        );
      return r.json();
    }),
    fetch('/font-index/glyphs.bin.gz').then((r) => r.arrayBuffer()),
  ])
    .then(([manifest, compressed]) => {
      const raw = new Uint8Array(compressed);
      const bytes = raw[0] === 31 && raw[1] === 139 ? gunzipSync(raw) : raw;
      if (
        bytes.length !==
        manifest.fonts.length * manifest.characters.length * manifest.stride
      )
        throw new Error('The font index is incomplete. Reload and try again.');
      return {
        ...manifest,
        data: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      };
    })
    .catch((error) => {
      indexPromise = undefined;
      throw error;
    }));
}
self.onmessage = async (event) => {
  let canvas: OffscreenCanvas | undefined;
  const loaded: FontFace[] = [];
  try {
    if (!('OffscreenCanvas' in self) || !('fonts' in self))
      throw new Error(
        'Local font matching needs OffscreenCanvas and worker fonts. Try a current Chromium browser.',
      );
    self.postMessage({ progress: 'Loading the local glyph index?' });
    const data = await index(),
      { image, text } = event.data;
    const target = silhouette(image),
      prepared = segmentGlyphs(image, event.data.threshold || 128);
    const letters = [...text.replace(/\s/g, '')];
    if (!prepared.glyphs.length)
      throw new Error(
        'No clear glyphs found. Tighten the crop or adjust the threshold.',
      );
    const scored = data.fonts
      .map((font, fi) => {
        let total = 0,
          measurements = 0;
        for (
          let i = 0;
          i < Math.min(letters.length, prepared.glyphs.length);
          i++
        ) {
          const ci = data.characters.indexOf(letters[i]);
          if (ci < 0) continue;
          const offset = (fi * data.characters.length + ci) * data.stride,
            glyph = prepared.glyphs[i];
          let delta = 0;
          for (let p = 0; p < 192; p++)
            delta +=
              Math.abs(glyph.values[p] - data.data.getUint8(offset + p)) / 255;
          const aspect = data.data.getFloat32(offset + 192, true);
          total +=
            delta / 192 + 0.18 * Math.abs(Math.log(glyph.aspect / aspect));
          measurements++;
        }
        return { ...font, glyphScore: total / Math.max(1, measurements) };
      })
      .sort((a, b) => a.glyphScore - b.glyphScore)
      .slice(0, 24);
    canvas = new OffscreenCanvas(2400, 200);
    const ctx = canvas.getContext('2d')!;
    const results = [];
    for (let i = 0; i < scored.length; i++) {
      const font = scored[i];
      self.postMessage({
        progress: `Rendering candidate ${i + 1} of ${scored.length} from ${data.fonts.length} families?`,
      });
      const family = 'KittyMatch-' + font.id,
        face = new FontFace(family, `url(${font.url})`);
      await face.load();
      (self as any).fonts.add(face);
      loaded.push(face);
      let best = Infinity,
        weight = 400,
        proportion = 0,
        spacing = 0;
      for (const w of [400, 700]) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = `${w} 80px "${family}"`;
        ctx.textBaseline = 'alphabetic';
        const measured = ctx.measureText(text).width,
          scale = Math.min(1, 2350 / measured);
        ctx.save();
        ctx.scale(scale, 1);
        ctx.fillStyle = '#000';
        ctx.fillText(text, 12, 130);
        ctx.restore();
        const sampleImage = ctx.getImageData(0, 0, canvas.width, canvas.height),
          sample = silhouette(sampleImage);
        sample.aspect /= scale;
        const value = score(target, sample);
        if (value < best) {
          best = value;
          weight = w;
          proportion = Math.abs(Math.log(target.aspect / sample.aspect));
          const sampleGlyphs = segmentGlyphs(sampleImage).glyphs;
          const gaps = (glyphs: any[]) =>
            glyphs
              .slice(1)
              .map(
                (g: any, j: number) =>
                  (g.x - glyphs[j].x - glyphs[j].width) / Math.max(1, g.height),
              );
          const a = gaps(prepared.glyphs),
            b = gaps(sampleGlyphs);
          spacing =
            a.length === b.length && a.length
              ? a.reduce(
                  (n: number, g: number, j: number) => n + Math.abs(g - b[j]),
                  0,
                ) / a.length
              : 1;
        }
      }
      results.push({ ...font, score: best, weight, proportion, spacing });
    }
    self.postMessage({
      results: results.sort((a, b) => a.score - b.score).slice(0, 6),
      familyCount: data.fonts.length,
      segmented: prepared.glyphs.length,
    });
  } catch (error) {
    self.postMessage({ error: (error as Error).message });
  } finally {
    if (canvas) canvas.width = canvas.height = 0;
    for (const face of loaded) (self as any).fonts.delete(face);
  }
};
