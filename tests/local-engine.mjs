// Local engine tools on the production preview (:4321): OCR PDF, Protect PDF, and (when built)
// Remove Background. Run: node tests/local-engine.mjs   (ONLY=ocr|protect|background to run one)
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const base = process.env.BASE || 'http://localhost:4321';
const only = process.env.ONLY;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const outside = [];
const modelRequests = [];
page.on('request', (r) => {
  if (r.url().includes('/models/isnet/isnet.part')) modelRequests.push(r.url());
  const url = new URL(r.url());
  if (!['localhost', '127.0.0.1'].includes(url.hostname) && !url.protocol.startsWith('blob') && !url.protocol.startsWith('data'))
    outside.push(r.url());
});

const lines = [
  ['KittySuite local OCR test', 'Invoices are processed privately', 'Total amount due 4821 rupees'],
  ['The quick brown fox jumps over', 'the lazy dog near the river bank', 'Reference number 77310'],
];
// A page "scanned" as a JPEG image: no text objects at all.
async function scanImage(text, angle = 0) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1700" height="2200"><rect width="100%" height="100%" fill="#fbfaf6"/>${text
    .map((t, i) => `<text x="160" y="${320 + i * 110}" font-family="DejaVu Serif, serif" font-size="56" fill="#1a1a1a">${t}</text>`)
    .join('')}</svg>`;
  return sharp(Buffer.from(svg)).rotate(angle, { background: '#fbfaf6' }).resize(1700, 2200, { fit: 'cover' }).jpeg({ quality: 82 }).toBuffer();
}
async function scannedPDF() {
  const doc = await PDFDocument.create();
  for (const [i, text] of lines.entries()) {
    const jpg = await doc.embedJpg(await scanImage(text, i === 1 ? 1.2 : 0));
    doc.addPage([612, 792]).drawImage(jpg, { x: 0, y: 0, width: 612, height: 792 });
  }
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([612, 792]).drawText('This page already has real selectable text in it.', { x: 60, y: 700, size: 14, font });
  return Buffer.from(await doc.save());
}
async function textOf(bytes, password) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), password }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++)
    pages.push((await (await doc.getPage(i)).getTextContent()).items.map((x) => x.str).join(' '));
  return pages;
}
const downloadBytes = async () => {
  const event = page.waitForEvent('download');
  await page.locator('#pdf-download').click();
  return readFile(await (await event).path());
};
const noOverflow = async (label) => {
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label} overflow at ${width}`);
  }
};
const axe = async (label) => {
  const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  assert.deepEqual(a11y.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })), [], label);
};

try {
  if (!only || only === 'protect') {
    await page.goto(`${base}/protect-pdf/`);
    assert.equal(await page.locator('h1').innerText(), 'Password Protect a PDF');
    await noOverflow('protect');
    const doc = await PDFDocument.create();
    for (let i = 0; i < 3; i++) doc.addPage().drawText(`Confidential page ${i + 1}`, { x: 60, y: 700, size: 20 });
    // Invalid file first.
    await page.locator('#pdf-files').setInputFiles({ name: 'fake.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a pdf') });
    await page.waitForFunction(() => /could not|cannot|damaged|unsupported/i.test(document.querySelector('#pdf-status').textContent));
    await page.locator('#pdf-files').setInputFiles({ name: 'plan.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await doc.save()) });
    await page.locator('#pdf-editor').waitFor({ state: 'visible' });
    await axe('protect editor');
    await page.locator('#protect-password').fill('kitty-123');
    await page.locator('#protect-confirm').fill('kitty-124');
    await page.locator('#pdf-export').click();
    await page.waitForFunction(() => /do not match/.test(document.querySelector('#pdf-status').textContent));
    await page.locator('[data-reveal]').click();
    assert.equal(await page.locator('#protect-password').getAttribute('type'), 'text');
    await page.locator('#protect-password').fill('abc');
    await page.locator('#protect-confirm').fill('abc');
    await page.locator('#pdf-export').click();
    await page.waitForFunction(() => /at least 6/.test(document.querySelector('#pdf-status').textContent));
    await page.locator('#protect-password').fill('kitty-123 ✓');
    await page.locator('#protect-confirm').fill('kitty-123 ✓');
    await page.locator('#pdf-export').click();
    await page.locator('#pdf-result').waitFor({ state: 'visible' });
    assert.match(await page.locator('#pdf-summary').innerText(), /AES-256/);
    const locked = await downloadBytes();
    assert.match(locked.toString('latin1'), /\/V 5[\s\S]*\/R 6|\/R 6[\s\S]*\/V 5/, 'AES-256 (V5 R6) encryption dictionary');
    await assert.rejects(textOf(locked), /password/i, 'must not open without a password');
    await assert.rejects(textOf(locked, 'wrong'), /password/i, 'must not open with a wrong password');
    const opened = await textOf(locked, 'kitty-123 ✓');
    assert.equal(opened.length, 3);
    assert.match(opened[2], /Confidential page 3/);
    // Restricted copy still opens with the password.
    await page.locator('#pdf-back').click();
    await page.locator('#protect-restrict').check();
    await page.locator('#pdf-export').click();
    await page.locator('#pdf-result').waitFor({ state: 'visible' });
    const restricted = await downloadBytes();
    const rdoc = await pdfjs.getDocument({ data: new Uint8Array(restricted), password: 'kitty-123 ✓' }).promise;
    const perms = await rdoc.getPermissions();
    assert.ok(perms && ![...perms].includes(pdfjs.PermissionFlag.PRINT) && ![...perms].includes(pdfjs.PermissionFlag.COPY), 'printing and copying blocked');
    console.log('protect-pdf: ok');
  }

  if (!only || only === 'ocr') {
    await page.goto(`${base}/ocr-pdf/`);
    assert.equal(await page.locator('h1').innerText(), 'OCR PDF');
    await noOverflow('ocr');
    const before = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name));
    assert.ok(!before.some((u) => u.includes('/local-engine/')), 'OCR engine must load only when used');
    await page.locator('#pdf-files').setInputFiles({ name: 'scan.pdf', mimeType: 'application/pdf', buffer: await scannedPDF() });
    await page.locator('#pdf-editor').waitFor({ state: 'visible' });
    await axe('ocr editor');
    await page.locator('#ocr-save-text').check();
    const started = Date.now();
    await page.locator('#pdf-export').click();
    await page.locator('#pdf-progress-wrap').waitFor({ state: 'visible' });
    await page.locator('#pdf-result').waitFor({ state: 'visible', timeout: 240000 });
    console.log('ocr seconds', ((Date.now() - started) / 1000).toFixed(1), await page.locator('#pdf-summary').innerText());
    assert.match(await page.locator('#pdf-summary').innerText(), /2 pages read.*1 skipped/);
    const event = page.waitForEvent('download');
    await page.locator('#pdf-output a[download$=".pdf"], #pdf-download').first().click();
    const searchable = await readFile(await (await event).path());
    const text = await textOf(searchable);
    assert.equal(text.length, 3);
    const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ');
    for (const [i, page] of lines.entries())
      for (const line of page) {
        const words = line.toLowerCase().split(' ');
        const hits = words.filter((w) => norm(text[i]).includes(w)).length;
        assert.ok(hits / words.length >= 0.8, `page ${i + 1} should contain "${line}" (got "${text[i]}")`);
      }
    assert.match(text[2], /already has real selectable text/);
    assert.ok(!/KittySuite local OCR/.test(text[2]));
    // Cancel mid-run returns the UI to a usable state.
    await page.locator('#pdf-back').click();
    await page.locator('#ocr-skip-text').uncheck();
    await page.locator('#ocr-language').selectOption('fra');
    await page.locator('#pdf-export').click();
    await page.locator('#pdf-progress-wrap').waitFor({ state: 'visible' });
    await page.locator('#pdf-cancel').click();
    await page.waitForFunction(() => /Cancelled/.test(document.querySelector('#pdf-status').textContent), null, { timeout: 60000 });
    assert.equal(await page.locator('#pdf-export').isDisabled(), false);
    assert.equal(await page.locator('#pdf-progress-wrap').isHidden(), true);
    console.log('ocr-pdf: ok');
  }
  if (!only || only === 'background') {
    await page.goto(`${base}/remove-background/`);
    assert.equal(await page.locator('h1').innerText(), 'Remove Image Background');
    await noOverflow('background');
    await axe('background upload');
    const loaded = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name));
    assert.ok(!loaded.some((u) => /\/models\/|\/local-engine\//.test(u)), 'model and runtime must load only on demand');
    // Unsupported type.
    await page.locator('#ai-file').setInputFiles({ name: 'anim.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') });
    await page.waitForFunction(() => /JPG, PNG or WebP/.test(document.querySelector('#ai-status').textContent));
    // A product-style photo: a dark mug on a pale gradient backdrop, as JPG, PNG and WebP.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9e4da"/><stop offset="1" stop-color="#c9c2b4"/></linearGradient></defs><rect width="900" height="700" fill="url(#g)"/><ellipse cx="450" cy="560" rx="190" ry="26" fill="#b1a998"/><rect x="300" y="210" width="300" height="350" rx="28" fill="#7a1f2b"/><path d="M600 290 q110 0 110 110 q0 110 -110 110" fill="none" stroke="#7a1f2b" stroke-width="38"/><rect x="330" y="250" width="40" height="260" rx="20" fill="#a33644"/></svg>`;
    const photo = sharp(Buffer.from(svg));
    const formats = [
      ['mug.jpg', 'image/jpeg', await photo.clone().jpeg({ quality: 88 }).toBuffer()],
      ['mug.png', 'image/png', await photo.clone().png().toBuffer()],
      ['mug.webp', 'image/webp', await photo.clone().webp().toBuffer()],
    ];
    for (const [i, [name, mimeType, buffer]] of formats.entries()) {
      if (i) await page.locator('#ai-reset').click();
      await page.locator('#ai-file').setInputFiles({ name, mimeType, buffer });
      await page.locator('#ai-editor').waitFor({ state: 'visible' });
      if (!i) await axe('background editor');
      const started = Date.now();
      await page.locator('#ai-run').click();
      if (!i) await page.locator('#ai-progress-wrap').waitFor({ state: 'visible' });
      await page.locator('#ai-download').waitFor({ state: 'visible', timeout: 300000 });
      console.log(name, 'seconds', ((Date.now() - started) / 1000).toFixed(1), '|', await page.locator('#ai-status').innerText());
      const event = page.waitForEvent('download');
      await page.locator('#ai-download').click();
      const png = await readFile(await (await event).path());
      const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.equal(info.width, 900);
      const alpha = (x, y) => data[(y * info.width + x) * 4 + 3];
      assert.ok(alpha(20, 20) < 20 && alpha(880, 30) < 20, `${name}: background should be transparent`);
      assert.ok(alpha(450, 380) > 235, `${name}: the mug should stay opaque`);
    }
    // White background re-composites without running the model again.
    await page.locator('label.format-card:has(input[value="#ffffff"])').click();
    await page.waitForFunction(() => document.querySelector('#ai-after').complete);
    const event = page.waitForEvent('download');
    await page.locator('#ai-download').click();
    const white = await sharp(await readFile(await (await event).path())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([...white.data.subarray(0, 4)], [255, 255, 255, 255]);
    // Second visit uses the cached model (no new model downloads).
    assert.ok(modelRequests.length <= 4, `model parts downloaded once (saw ${modelRequests.length})`);
    console.log('remove-background: ok');
  }
  if (!only || only === 'upscale') {
    await page.goto(`${base}/upscale-image/`);
    assert.equal(await page.locator('h1').innerText(), 'Upscale Image');
    await noOverflow('upscale');
    await axe('upscale upload');
    // Too large for the 1 MP input limit.
    const big = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: '#88aacc' } }).jpeg().toBuffer();
    await page.locator('#ai-file').setInputFiles({ name: 'big.jpg', mimeType: 'image/jpeg', buffer: big });
    await page.waitForFunction(() => /1 megapixel/.test(document.querySelector('#ai-status').textContent));
    // A small image with sharp edges and some JPEG blocking.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="140"><rect width="200" height="140" fill="#f4efe6"/><circle cx="70" cy="70" r="42" fill="#1f6f63"/><text x="118" y="84" font-family="DejaVu Sans" font-size="40" font-weight="700" fill="#7a1f2b">Ks</text></svg>`;
    const small = await sharp(Buffer.from(svg)).jpeg({ quality: 60 }).toBuffer();
    await page.locator('#ai-file').setInputFiles({ name: 'logo.jpg', mimeType: 'image/jpeg', buffer: small });
    await page.locator('#ai-editor').waitFor({ state: 'visible' });
    await axe('upscale editor');
    const started = Date.now();
    await page.locator('#ai-run').click();
    await page.locator('#ai-download').waitFor({ state: 'visible', timeout: 300000 });
    console.log('upscale seconds', ((Date.now() - started) / 1000).toFixed(1), '|', await page.locator('#ai-status').innerText());
    let event = page.waitForEvent('download');
    await page.locator('#ai-download').click();
    let meta = await sharp(await readFile(await (await event).path())).metadata();
    assert.deepEqual([meta.width, meta.height, meta.format], [400, 280, 'png']);
    // 4x and JPG re-render from the same model output, without running the model again.
    await page.locator('label.format-card:has(input[name=ai-scale][value="4"])').click();
    await page.locator('#ai-format').selectOption('image/jpeg');
    await page.waitForFunction(() => /\.jpg$/.test(document.querySelector('#ai-download').download));
    event = page.waitForEvent('download');
    await page.locator('#ai-download').click();
    const fourX = await readFile(await (await event).path());
    meta = await sharp(fourX).metadata();
    assert.deepEqual([meta.width, meta.height, meta.format], [800, 560, 'jpeg']);
    // Sharper than plain bicubic enlargement: compare edge energy around the circle.
    const sharpness = async (buffer) => {
      const { data, info } = await sharp(buffer).greyscale().raw().toBuffer({ resolveWithObject: true });
      let sum = 0;
      for (let y = 1; y < info.height - 1; y++) for (let x = 1; x < info.width - 1; x++) {
        const i = y * info.width + x;
        sum += Math.abs(4 * data[i] - data[i - 1] - data[i + 1] - data[i - info.width] - data[i + info.width]);
      }
      return sum / (info.width * info.height);
    };
    const bicubic = await sharp(small).resize(800, 560, { kernel: 'cubic' }).png().toBuffer();
    const [ai, plain] = [await sharpness(fourX), await sharpness(bicubic)];
    console.log('edge energy ai', ai.toFixed(2), 'bicubic', plain.toFixed(2));
    assert.ok(ai > plain * 1.1, 'AI upscale should be sharper than bicubic');
    console.log('upscale: ok');
  }
  assert.deepEqual(outside, [], 'no requests may leave this site');
  assert.deepEqual(errors, []);
  console.log('local engine tests passed');
} finally {
  await browser.close();
}
