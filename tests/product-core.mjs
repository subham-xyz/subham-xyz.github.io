import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import {
  parsePages,
  assemblePDF,
  imagesPDF,
  rewritePDF,
  readFields,
  fillPDF,
} from '../src/scripts/pdf-core.mjs';
import { rotationSize, cropBounds } from '../src/scripts/image-edit-core.mjs';
import { tools, categories, popularTools } from '../src/data/tools.ts';
import { readFile, access } from 'node:fs/promises';
assert.equal(new Set(tools.map((t) => t.id)).size, tools.length);
assert.equal(new Set(tools.map((t) => t.slug)).size, tools.length);
assert.deepEqual(
  popularTools.map((t) => t.popularOrder),
  [1, 2, 3, 4, 5, 6],
);
for (const tool of tools) {
  assert.ok(categories.includes(tool.category) && tool.subcategory);
  if (tool.status === 'ready') await access(`dist/${tool.slug}/index.html`);
  else assert.equal(tool.href, '');
}
assert.deepEqual(parsePages('1,3-4', 4), [0, 2, 3]);
assert.throws(() => parsePages('0,8', 4));
assert.throws(() => parsePages('3-1', 4));
const a = await PDFDocument.create();
a.addPage([200, 300]).drawText('PAGE A');
a.addPage([300, 400]).drawText('PAGE B');
const b = await PDFDocument.create();
b.addPage([400, 500]).drawText('PAGE C');
const sources = [await a.save(), await b.save()];
let out = await PDFDocument.load(
  await assemblePDF(sources, [
    { source: 1, index: 0 },
    { source: 0, index: 1 },
    { source: 0, index: 0 },
  ]),
);
assert.deepEqual(
  out.getPages().map((p) => p.getWidth()),
  [400, 300, 200],
);
for (const selection of [
  [{ source: 0, index: 0 }],
  [{ source: 0, index: 1 }],
]) {
  out = await PDFDocument.load(await assemblePDF(sources, selection));
  assert.equal(out.getPageCount(), 1);
}
assert.rejects(() => assemblePDF(sources, []));
out = await PDFDocument.load(
  await assemblePDF(
    sources,
    [
      { source: 0, index: 0 },
      { source: 0, index: 1 },
    ],
    { mode: 'rotate-pdf', range: '2', angle: 90 },
  ),
);
assert.equal(out.getPage(0).getRotation().angle, 0);
assert.equal(out.getPage(1).getRotation().angle, 90);
out = await PDFDocument.load(
  await assemblePDF(sources, [{ source: 0, index: 0 }], {
    mode: 'crop-pdf',
    rect: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
  }),
);
assert.equal(out.getPage(0).getCropBox().width, 160);
for (const mode of ['page-numbers', 'watermark-pdf', 'edit-pdf', 'sign-pdf']) {
  const bytes = await assemblePDF(sources, [{ source: 0, index: 0 }], {
    mode,
    text: 'VISIBLE NOTE',
    start: 8,
    numberFormat: '{n}/{total}',
    shapes:
      mode === 'edit-pdf'
        ? [
            { kind: 'rect', x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
            {
              kind: 'pen',
              points: [
                { x: 0.1, y: 0.1 },
                { x: 0.5, y: 0.5 },
              ],
            },
          ]
        : [],
  });
  out = await PDFDocument.load(bytes);
  assert.equal(out.getPageCount(), 1);
  assert.ok(bytes.length > 500);
}
const jpg = await sharp({
  create: { width: 100, height: 80, channels: 3, background: '#ff0000' },
})
  .jpeg()
  .toBuffer();
out = await PDFDocument.load(
  await imagesPDF(
    [
      { bytes: jpg, mime: 'image/jpeg' },
      { bytes: jpg, mime: 'image/jpeg' },
    ],
    { pageSize: 'a4', orientation: 'landscape', margin: 24, fit: 'fill' },
  ),
);
assert.equal(out.getPageCount(), 2);
assert.ok(out.getPage(0).getWidth() > out.getPage(0).getHeight());
assert.equal(
  (await PDFDocument.load(await rewritePDF(sources[0]))).getPageCount(),
  2,
);
const form = await PDFDocument.create(),
  formPage = form.addPage();
form.getForm().createTextField('Name').addToPage(formPage);
form.getForm().createCheckBox('Agree').addToPage(formPage);
const formBytes = await form.save();
assert.equal((await readFields(formBytes)).length, 2);
out = await PDFDocument.load(
  await fillPDF(formBytes, { Name: 'Local user', Agree: true }),
);
assert.equal(out.getForm().getTextField('Name').getText(), 'Local user');
assert.equal(out.getForm().getCheckBox('Agree').isChecked(), true);
assert.deepEqual(rotationSize(80, 120, 90), { width: 120, height: 80 });
assert.deepEqual(cropBounds({ x: 5, y: 10, w: 40, h: 30 }, 100, 80), {
  x: 5,
  y: 10,
  w: 40,
  h: 30,
});
assert.throws(() => cropBounds({ x: 90, y: 0, w: 20, h: 30 }, 100, 80));
const sitemap = await readFile('dist/sitemap.xml', 'utf8');
for (const tool of tools.filter((t) => t.status === 'ready'))
  assert.ok(sitemap.includes(tool.href));
const manifest = JSON.parse(
  await readFile('public/font-index/manifest.json', 'utf8'),
);
assert.ok(manifest.fonts.length >= 1000);
for (const font of manifest.fonts)
  assert.match(
    await readFile('public' + font.license, 'utf8'),
    /SIL OPEN FONT LICENSE/i,
  );
console.log(
  `PASS: registry/routes, ${manifest.fonts.length} OFL fonts, PDF merge/order/split/remove/extract/rotate/crop/annotations/images/forms/rewrite, image rotation/crop guards.`,
);
