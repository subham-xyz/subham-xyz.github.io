// Font Finder accuracy benchmark: renders random fonts from the index and checks where
// the true font ranks. Run against a production build on :4321: npm run bench:fonts
// Options: N (fonts, default 30), SEED, SENS (ink sensitivity), V=1 (list misses), CASES (JSON).
import { chromium } from 'playwright';
import { readFileSync, readdirSync } from 'node:fs';
const workerFile = readdirSync('/home/claude/ks/dist/_astro').find((f) => f.startsWith('font-worker'));
const manifest = JSON.parse(readFileSync('/home/claude/ks/public/font-index/manifest.json', 'utf8'));
let seed = Number(process.env.SEED || 3);
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const N = Number(process.env.N || 30);
// STYLE=regular|bold|italic picks families that have that style and renders the real file.
const STYLE = process.env.STYLE || 'regular';
const styled = STYLE === 'regular' ? null : new Map((manifest.styles?.[STYLE] || []).map((e) => [e.font, e]));
const picks = [];
while (picks.length < N) {
  const i = Math.floor(rnd() * manifest.fonts.length);
  const f = manifest.fonts[i];
  if (picks.some((p) => p.id === f.id) || (styled && !styled.has(i))) continue;
  picks.push(styled ? { ...f, url: styled.get(i).url } : f);
}
const cases = [];
for (const f of picks) for (const [text, size, blur] of (process.env.CASES ? JSON.parse(process.env.CASES) : [['Hamburgefonts', 80, 0], ['The quick brown fox', 44, 0.6], ['Design Studio', 32, 0.8]])) cases.push({ sens: Number(process.env.SENS || 0.5), upscale: !!process.env.UP, id: f.id, name: f.name, url: f.url, text, size, blur });
const b = await chromium.launch(); const p = await b.newPage();
await p.goto((process.env.BASE || 'http://localhost:4321') + '/font-finder/');
const results = await p.evaluate(async ({ cases, workerFile }) => {
  const out = [];
  const worker = new Worker('/_astro/' + workerFile, { type: 'module' });
  const run = (msg) => new Promise((res) => { worker.onmessage = (e) => { if (e.data.progress) return; res(e.data); }; worker.postMessage(msg); });
  for (const c of cases) {
    const fam = 'Bench-' + c.id; const face = new FontFace(fam, `url(${c.url})`); await face.load(); document.fonts.add(face);
    const cv = document.createElement('canvas'); const ctx = cv.getContext('2d'); ctx.font = `${c.size}px "${fam}"`;
    const w = Math.ceil(ctx.measureText(c.text).width) + 40, h = Math.ceil(c.size * 1.6);
    cv.width = w; cv.height = h; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.filter = c.blur ? `blur(${c.blur}px)` : 'none';
    ctx.font = `${c.size}px "${fam}"`; ctx.fillStyle = '#111'; ctx.textBaseline = 'middle'; ctx.fillText(c.text, 20, h / 2);
    const sc = c.upscale ? Math.min(4, 1600 / w, 400 / h, Math.max(1, 160 / h)) : 1;
    const cv2 = document.createElement('canvas'); cv2.width = Math.round(w * sc); cv2.height = Math.round(h * sc);
    const c2 = cv2.getContext('2d'); c2.drawImage(cv, 0, 0, cv2.width, cv2.height);
    const image = c2.getImageData(0, 0, cv2.width, cv2.height);
    const t0 = performance.now();
    const r = await run({ text: c.text, image, sensitivity: c.sens });
    document.fonts.delete(face);
    const names = (r.results || []).map((x) => x.name.replace(/ (Bold|Italic)$/, ''));
    const styleHit = (r.results || [])[names.indexOf(c.name)]?.style;
    out.push({ styleHit, styles: (r.styles || []).join('+'), key: c.text + '|' + c.size + '|' + c.blur, short: r.stageOne, paired: r.paired, segs: r.segmented, name: c.name, text: c.text, size: c.size, rank: names.indexOf(c.name), err: r.error, ms: Math.round(performance.now() - t0), top: names[0] });
  }
  return out;
}, { cases, workerFile });
await b.close();
const by = (f) => results.filter(f);
const top1 = by((r) => r.rank === 0).length, top6 = by((r) => r.rank >= 0).length;
console.log('style', STYLE, '| indexes searched:', [...new Set(results.map((r) => r.styles))].join(', '), '| right style when found:', results.filter((r) => r.rank >= 0 && (r.styleHit || 'regular') === (STYLE === 'regular' ? 'regular' : STYLE)).length, '/', results.filter((r) => r.rank >= 0).length);
console.log(`cases ${results.length}: top1 ${top1} (${Math.round(top1 / results.length * 100)}%), top6 ${top6} (${Math.round(top6 / results.length * 100)}%), errors ${by((r) => r.err).length}, avg ms ${Math.round(results.reduce((n, r) => n + r.ms, 0) / results.length)}`);
for (const t of [...new Set(cases.map((c) => c.text + '|' + c.size + '|' + c.blur))]) { const s = by((r) => r.key === t); console.log(t, 'top1', s.filter((r) => r.rank === 0).length, 'top6', s.filter((r) => r.rank >= 0).length, '/', s.length); }
if (process.env.V) for (const r of results) console.log(r.rank, r.name, '|', r.text, r.size, '| top:', r.top, r.err || '');
