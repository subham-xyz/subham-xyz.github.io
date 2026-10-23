import { fonts } from './font-catalog.mjs';
import { silhouette, score } from './font-score.mjs';
let loaded: Promise<void> | undefined;
self.onmessage = async (event) => {
  try {
    if (!('OffscreenCanvas' in self) || !('fonts' in self)) throw new Error('This browser cannot run local font comparison. Try a current Chrome, Firefox or Safari browser.');
    loaded ||= Promise.all(fonts.map(async font => {
      const face = new FontFace(font.name, `url(${font.url})`, {weight: font.weightRange});
      await face.load(); (self as any).fonts.add(face);
    })).then(() => {});
    await loaded;
    const target = silhouette(event.data.image);
    const results = [];
    const canvas = new OffscreenCanvas(2048, 180), ctx = canvas.getContext('2d')!;
    for (const font of fonts) {
      let best = Infinity, weight = 400;
      for (const w of [400, 700]) {
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = `${w} 80px "${font.name}"`; ctx.fillStyle = '#000'; ctx.textBaseline = 'alphabetic';
        const measured = ctx.measureText(event.data.text).width;
        const scale = Math.min(1, 2000 / measured);
        ctx.save(); ctx.scale(scale, 1); ctx.fillText(event.data.text, 12, 120); ctx.restore();
        const sample = silhouette(ctx.getImageData(0, 0, canvas.width, canvas.height));
        sample.aspect /= scale;
        const value = score(target, sample);
        if (value < best) { best = value; weight = w; }
      }
      results.push({ ...font, score: best, weight });
    }
    canvas.width = canvas.height = 0;
    self.postMessage({ results: results.sort((a, b) => a.score - b.score) });
  } catch (error) { loaded = undefined; self.postMessage({ error: (error as Error).message }); }
};
