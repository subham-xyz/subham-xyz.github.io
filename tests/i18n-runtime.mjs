// Localized pages in a real browser: html[lang], hreflang, language switching, and
// no English interface text after using the tools (status lines, errors, results).
// Serve the production build first: npm run build && npm run serve:dist
// Run: BASE=http://localhost:4322 node tests/i18n-runtime.mjs
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const base = process.env.BASE || 'http://localhost:4322';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

const png = await sharp({ create: { width: 640, height: 420, channels: 3, background: '#4f9da6' } }).png().toBuffer();
const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
for (let i = 0; i < 2; i++) doc.addPage([400, 500]).drawText(`Page ${i + 1} sample text`, { x: 40, y: 400, size: 18, font });
const pdf = Buffer.from(await doc.save());

// Latin-script words left on a Japanese or Korean page are untranslated copy.
const ALLOWED = /^(KittySuite|Loki|PDF|JPG|JPEG|PNG|WebP|AVIF|GIF|SVG|TIFF|BMP|HEIC|HEIF|ICO|ZIP|HTML|CSS|EXIF|GPS|XMP|IPTC|OCR|AES|KB|MB|px|pt|dpi|ID|SSC|UPSC|NEET|JEE|CUET|IBPS|NTA|PAN|Aadhaar|e-Aadhaar|Real-ESRGAN|Tesseract|Google|Fonts|SIL|Open|Font|License|Chrome|Edge|Firefox|Safari|WebGPU|WebAssembly|CPU|GPU|Ctrl|F|Esc|Enter|Markdown|RGB|CMYK|sRGB|A4|A3|A5|Letter|Legal|Apple|Android|iPhone|IN|Gmail|Outlook|Office|Word|Excel|PowerPoint|kittysuite|kitty|suite|in|Adobe|Acrobat|Reader|iOS|macOS|Windows|SBI|RBI|UIDAI|Web3Forms|webmanifest|site|favicon|ico|apple|touch|icon|png|jpg|pdf|photo|a|b|Premium|Business|Basic|Lens|Preview|Acrobat|LibreOffice|OpenOffice|ODT|OTT|FODT|FFmpeg|MP3|MP4|M4A|AAC|WAV|OGG|Opus|FLAC|AIFF|WebM|MOV|MKV|AVI|SRT|VTT|WebVTT|ASS|LUFS|EBU|H|VP8|YouTube|Reels|Shorts|Stories|WhatsApp|Lato|fps|dB|Hz)$/i;
async function englishLeft(scope = 'body') {
  return page.evaluate(
    ({ scope, allowed }) => {
      const re = new RegExp(allowed, 'i');
      const out = new Set();
      const root = document.querySelector(scope);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement;
        if (!el || el.closest('script,style,code,pre,textarea,[translate="no"],[lang]:not(html),.font-match,#font-matches,[hidden]')) continue;
        if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
        // Quoted search examples stay in English: the command parser reads English.
        const words = (n.data.replace(/[“"«「][^”"»」]*[”"»」]/g, ' ').match(/[A-Za-z][A-Za-z0-9'’-]+/g) || []).filter((w) => !re.test(w) && w.length > 1);
        if (words.length >= 2) out.add(n.data.trim().slice(0, 100));
      }
      return [...out];
    },
    { scope, allowed: ALLOWED.source },
  );
}

const leftovers = [];
for (const locale of (process.env.LOCALES || 'ja,ko').split(',')) {
  const flows = [
    [`/${locale}/`, async () => {
      await page.locator('#home-search').fill('compress 50kb');
      await page.waitForTimeout(200);
      await page.locator('#home-search').fill('zzzz');
      await page.waitForTimeout(200);
    }],
    [`/${locale}/compress-image/`, async () => {
      await page.locator('input[type=file]').first().setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png });
      await page.waitForTimeout(1500);
    }],
    [`/${locale}/crop-image/`, async () => {
      await page.locator('input[type=file]').first().setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png });
      await page.waitForTimeout(1500);
    }],
    [`/${locale}/merge-pdf/`, async () => {
      await page.locator('input[type=file]').first().setInputFiles([{ name: 'a.pdf', mimeType: 'application/pdf', buffer: pdf }, { name: 'b.pdf', mimeType: 'application/pdf', buffer: pdf }]);
      await page.waitForTimeout(2500);
    }],
    [`/${locale}/compress-pdf/`, async () => {
      await page.locator('input[type=file]').first().setInputFiles({ name: 'a.pdf', mimeType: 'application/pdf', buffer: pdf });
      await page.waitForTimeout(2500);
    }],
    [`/${locale}/font-finder/`, async () => {
      await page.locator('#font-example').click();
      await page.waitForTimeout(1500);
    }],
    ...['jpg-to-pdf', 'convert-to-jpg', 'rotate-image', 'watermark-image', 'meme-generator', 'photo-editor', 'favicon-generator', 'image-size-checker', 'blur-face', 'convert-from-jpg'].map((slug) => [
      `/${locale}/${slug}/`,
      async () => {
        await page.locator('input[type=file]').first().setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png });
        await page.waitForTimeout(1500);
      },
    ]),
    ...['split-pdf', 'pdf-to-jpg', 'sign-pdf', 'page-numbers', 'watermark-pdf', 'rotate-pdf', 'protect-pdf', 'ocr-pdf', 'pdf-to-text', 'edit-pdf', 'redact-pdf', 'organize-pdf', 'extract-pages', 'remove-pages', 'crop-pdf', 'repair-pdf', 'pdf-forms', 'unlock-pdf'].map((slug) => [
      `/${locale}/${slug}/`,
      async () => {
        await page.locator('input[type=file]').first().setInputFiles({ name: 'a.pdf', mimeType: 'application/pdf', buffer: pdf });
        await page.waitForTimeout(2000);
      },
    ]),
    [`/${locale}/compare-pdf/`, async () => {
      await page.locator('input[type=file]').first().setInputFiles([{ name: 'a.pdf', mimeType: 'application/pdf', buffer: pdf }, { name: 'b.pdf', mimeType: 'application/pdf', buffer: pdf }]);
      await page.waitForTimeout(2500);
    }],
    ...['html-to-image', 'html-to-pdf', 'scan-to-pdf', 'india', 'pdf', 'images', 'fonts', 'about', 'privacy', 'terms', 'feedback', 'contact', 'pricing'].map((slug) => [`/${locale}/${slug}/`, async () => {}]),
    [`/${locale}/upscale-image/`, async () => {}],
    [`/${locale}/remove-image-metadata/`, async () => {
      await page.locator('input[type=file]').first().setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png });
      await page.waitForTimeout(1500);
    }],
  ];
  for (const [path, act] of flows) {
    await page.goto(base + path, { waitUntil: 'networkidle' });
    assert.equal(await page.getAttribute('html', 'lang'), locale, path);
    await act();
    for (const text of await englishLeft()) leftovers.push(`${path}: ${text}`);
  }
}

assert.deepEqual(leftovers, [], `English text left:\n${leftovers.join('\n')}`);

// Language menu: links to the equivalent page, keyboard reachable.
await page.goto(`${base}/de/bild-komprimieren/`);
assert.equal(await page.getAttribute('html', 'lang'), 'de');
assert.equal(await page.locator('link[rel=alternate][hreflang=pt-BR]').getAttribute('href'), 'https://kittysuite.in/pt-br/comprimir-imagem/');
assert.equal(await page.locator('link[rel=alternate][hreflang=x-default]').getAttribute('href'), 'https://kittysuite.in/compress-image/');
assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'), 'https://kittysuite.in/de/bild-komprimieren/');
await page.locator('.language-selector summary').focus();
await page.keyboard.press('Enter');
await page.locator('.language-panel a[hreflang=fr]').click();
await page.waitForURL(/\/fr\/compresser-image\/$/);
assert.equal(await page.getAttribute('html', 'lang'), 'fr');
// Internal links stay in the chosen language.
const hrefs = await page.locator('main a[href^="/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
assert.ok(hrefs.length && hrefs.every((h) => h.startsWith('/fr/') || /^\/(brand|_astro|guide)\//.test(h)), `non-French links: ${hrefs.filter((h) => !h.startsWith('/fr/')).slice(0, 5)}`);
assert.deepEqual(errors, []);
await browser.close();
console.log('PASS: localized tool flows fully translated at runtime; lang, canonical, hreflang, language switching and localized links.');
