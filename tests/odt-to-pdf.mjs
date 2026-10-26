// Conversion tests for ODT to PDF (src/scripts/odt-core.mjs), no browser needed.
// Run: node tests/odt-to-pdf.mjs
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import {
  convertODT,
  readODT,
  buildDocument,
  parseXML,
  toPt,
  fontKind,
  imageInfo,
} from '../src/scripts/odt-core.mjs';

const NS =
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"';
// 1×1 transparent PNG.
const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
);
const styles = `<?xml version="1.0" encoding="UTF-8"?><office:document-styles ${NS}>
<office:font-face-decls><style:font-face style:name="Liberation Sans" svg:font-family="'Liberation Sans'" style:font-family-generic="swiss"/></office:font-face-decls>
<office:styles><style:default-style style:family="paragraph"><style:text-properties fo:font-size="12pt"/></style:default-style>
<style:style style:name="Standard" style:family="paragraph"/>
<style:style style:name="Heading_20_1" style:family="paragraph"><style:paragraph-properties fo:keep-with-next="always"/><style:text-properties style:font-name="Liberation Sans" fo:font-size="18pt" fo:font-weight="bold"/></style:style>
<text:list-style style:name="L1"><text:list-level-style-number text:level="1" style:num-format="i" style:num-suffix=")"/></text:list-style></office:styles>
<office:automatic-styles><style:page-layout style:name="pm1"><style:page-layout-properties fo:page-width="8.5in" fo:page-height="11in" fo:margin="1in"/></style:page-layout></office:automatic-styles>
<office:master-styles><style:master-page style:name="Standard" style:page-layout-name="pm1"><style:footer><text:p>Page <text:page-number/> of <text:page-count/></text:p></style:footer></style:master-page></office:master-styles></office:document-styles>`;
const long = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(
  40,
);
const content = (
  body,
) => `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${NS}>
<office:automatic-styles><style:style style:name="B" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>
<style:style style:name="Break" style:family="paragraph"><style:paragraph-properties fo:break-before="page"/></style:style>
<style:style style:name="Cell" style:family="table-cell"><style:table-cell-properties fo:border="0.5pt solid #000000" fo:background-color="#eeeeee"/></style:style></office:automatic-styles>
<office:body><office:text>${body}</office:text></office:body></office:document-content>`;
const body = `<text:h text:style-name="Heading_20_1" text:outline-level="1">Report title</text:h>
<text:p>Hello <text:span text:style-name="B">Loki</text:span>&amp; friends<text:tab/>tab<text:s text:c="3"/>gap<text:line-break/>Résumé €5 “quoted”.</text:p>
<text:list text:style-name="L1"><text:list-item><text:p>First item</text:p></text:list-item><text:list-item><text:p>Second item</text:p></text:list-item></text:list>
<table:table><table:table-column table:number-columns-repeated="2"/><table:table-row><table:table-cell table:style-name="Cell"><text:p>Cell A</text:p></table:table-cell><table:table-cell table:style-name="Cell"><text:p>Cell B</text:p></table:table-cell></table:table-row></table:table>
<text:p><draw:frame text:anchor-type="as-char" svg:width="2cm" svg:height="1cm"><draw:image xlink:href="Pictures/a.png"/></draw:frame></text:p>
<text:p>${long}</text:p><text:p text:style-name="Break">Second page starts here.</text:p>
<text:p>Note<text:note><text:note-citation>1</text:note-citation><text:note-body><text:p>Footnote body.</text:p></text:note-body></text:note></text:p>
<office:annotation><text:p>Hidden comment</text:p></office:annotation>`;
const odt = (files) =>
  zipSync(
    Object.fromEntries(
      Object.entries(files).map(([k, v]) => [
        k,
        typeof v === 'string' ? strToU8(v) : v,
      ]),
    ),
  );
const sample = odt({
  mimetype: 'application/vnd.oasis.opendocument.text',
  'content.xml': content(body),
  'styles.xml': styles,
  'meta.xml': `<?xml version="1.0"?><office:document-meta ${NS}><office:meta><dc:title>Fixture doc</dc:title></office:meta></office:document-meta>`,
  'Pictures/a.png': PNG,
});

// Helpers
assert.equal(Math.round(toPt('2.54cm')), 72);
assert.equal(toPt('1in'), 72);
assert.equal(toPt('50%', 200), 100);
assert.equal(toPt('wide'), undefined);
assert.equal(fontKind('Liberation Mono'), 'mono');
assert.equal(fontKind('Liberation Sans'), 'sans');
assert.equal(fontKind('Liberation Serif'), 'serif');
assert.equal(fontKind('Noto Serif Devanagari'), 'serif');
assert.equal(imageInfo(PNG).mime, 'image/png');
const xml = parseXML('<a x="1 &amp; 2"><b/>t&#233;xt<![CDATA[<raw>]]></a>');
assert.equal(xml.children[0].attrs.x, '1 & 2');
assert.deepEqual(xml.children[0].children.slice(1), ['téxt', '<raw>']);

// Model
const model = buildDocument(readODT(sample));
assert.equal(Math.round(model.page.width), 612);
assert.equal(model.title, 'Fixture doc');
const paras = model.blocks.filter((b) => b.type === 'p');
assert.equal(paras[0].heading, 1);
assert.ok(paras[0].base.bold && paras[0].base.size === 18);
assert.equal(paras.find((p) => p.label)?.label.text, 'i)');
assert.ok(model.blocks.some((b) => b.type === 'table'));
assert.ok(
  !JSON.stringify(model.blocks).includes('Hidden comment'),
  'comments are not printed',
);

// Conversion
const result = await convertODT(sample);
assert.equal(result.mode, 'text');
assert.equal(result.pages, 2);
assert.deepEqual(result.warnings, []);
const pdf = await PDFDocument.load(result.bytes);
assert.equal(pdf.getPageCount(), result.pages);
assert.equal(pdf.getTitle(), 'Fixture doc');
assert.deepEqual(pdf.getPage(0).getSize(), { width: 612, height: 792 });
// Real, selectable text in the right places.
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const task = pdfjs.getDocument({ data: result.bytes.slice(), verbosity: 0 });
const doc = await task.promise;
const pageText = async (n) =>
  (await (await doc.getPage(n)).getTextContent()).items
    .map((i) => i.str)
    .join(' ');
const first = await pageText(1);
for (const s of [
  'Report title',
  'Loki',
  '& friends',
  'Résumé €5 “quoted”',
  'i)',
  'Cell B',
  'Page 1 of 2',
])
  assert.ok(first.includes(s), `page 1 has "${s}"`);
const second = await pageText(2);
for (const s of ['Second page starts here.', 'Footnote body.', 'Page 2 of 2'])
  assert.ok(second.includes(s), `page 2 has "${s}"`);
await task.destroy();

// Page size override keeps orientation.
const a4 = await convertODT(sample, { pageSize: 'a4' });
assert.deepEqual((await PDFDocument.load(a4.bytes)).getPage(0).getSize(), {
  width: 595.28,
  height: 841.89,
});

// Flat ODT (.fodt)
const fodt = strToU8(
  `<?xml version="1.0"?><office:document ${NS} office:mimetype="application/vnd.oasis.opendocument.text"><office:body><office:text><text:p>Flat file</text:p></office:text></office:body></office:document>`,
);
assert.equal((await convertODT(fodt)).pages, 1);

// Characters outside the PDF fonts: in Node (no canvas) they are flagged.
const hindi = odt({
  mimetype: 'application/vnd.oasis.opendocument.text',
  'content.xml': content('<text:p>नमस्ते Loki</text:p>'),
});
assert.ok((await convertODT(hindi)).warnings.includes('replaced-characters'));

// Errors are readable.
const rejects = async (bytes, pattern) =>
  assert.rejects(
    () => convertODT(bytes),
    (e) => pattern.test(e.message),
  );
await rejects(new Uint8Array(), /empty/);
await rejects(strToU8('hello world'), /not an OpenDocument/);
await rejects(odt({ 'word/document.xml': '<w/>' }), /Word/);
await rejects(
  odt({
    mimetype: 'application/vnd.oasis.opendocument.spreadsheet',
    'content.xml': '<x/>',
  }),
  /spreadsheet/,
);
await rejects(
  odt({
    mimetype: 'application/vnd.oasis.opendocument.text',
    'content.xml': 'xx',
    'META-INF/manifest.xml': '<manifest:encryption-data/>',
  }),
  /password/,
);
await rejects(Uint8Array.from([0x50, 0x4b, 3, 4, 1, 2, 3]), /damaged/);

console.log(
  'PASS: ODT to PDF (parsing, styles, lists, tables, images, page breaks, fields, flat ODT, page sizes, unsupported characters, errors).',
);
