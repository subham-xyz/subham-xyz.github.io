import assert from 'node:assert/strict';
import {
  parseSearchIntent,
  buildIntentRoute,
  describeIntent,
  readToolParams,
  STRONG_INTENT,
} from '../src/scripts/search-intent.mjs';

const expect = (query, tool, params = {}, strong = true) => {
  const intent = parseSearchIntent(query);
  assert.ok(intent, `"${query}" should be understood`);
  assert.equal(intent.tool, tool, `"${query}" → ${intent.tool}`);
  assert.deepEqual(intent.params, params, `"${query}" params`);
  if (strong)
    assert.ok(
      intent.confidence >= STRONG_INTENT,
      `"${query}" should be strong`,
    );
  return intent;
};
const kb = (targetSize) => ({ targetSize, unit: 'KB' });
const mb = (targetSize) => ({ targetSize, unit: 'MB' });

// Compress Image
expect('compress image', 'image-compressor');
expect('compress image to 20kb', 'image-compressor', kb(20));
expect('compress 50kb to 20kb', 'image-compressor', kb(20));
expect('Compress 50 KB to 20 KB', 'image-compressor', kb(20));
expect('reduce image below 1mb', 'image-compressor', mb(1));
expect('make image 100 kb', 'image-compressor', kb(100));
expect('reduce image to 200 kb', 'image-compressor', kb(200));
expect('image under 50kb', 'image-compressor', kb(50));
expect('compress photo below 1mb', 'image-compressor', mb(1));
expect('make this image smaller than 500kb', 'image-compressor', kb(500));
expect('compress jpg to 100kb', 'image-compressor', kb(100));
expect('compress png to 250 kb', 'image-compressor', kb(250));
expect('reduce 2mb image under 500kb', 'image-compressor', kb(500));
expect('compress image to 0.5mb', 'image-compressor', mb(0.5));
expect('convert png to jpg under 100kb', 'image-compressor', {
  ...kb(100),
  format: 'jpg',
});
expect('compress image to -20kb', 'image-compressor', {});
expect('compress 50kb to', 'image-compressor', {}); // still typing
assert.ok(parseSearchIntent('compress something').confidence < STRONG_INTENT);

// Resize Image
for (const q of [
  'resize 1080x1080',
  'resize 1080 x 1080',
  'resize 1080×1080',
  'resize 1080 by 1080',
  'resize image to 1080x1080',
])
  expect(q, 'image-resizer', { width: 1080, height: 1080 });
expect('resize to 1920x1080px', 'image-resizer', { width: 1920, height: 1080 });
expect('make image 800 by 600', 'image-resizer', { width: 800, height: 600 });
expect('resize photo 1200 630', 'image-resizer', { width: 1200, height: 630 });
expect('make image width 1080', 'image-resizer', { width: 1080 });
expect('resize height 720', 'image-resizer', { height: 720 });
expect('resize to 512px', 'image-resizer', { width: 512 });
expect('resize to 600x600 under 50kb', 'image-resizer', {
  width: 600,
  height: 600,
  ...kb(50),
});
expect('resize to 0x0', 'image-resizer', {});
expect('resize to 999999x999999', 'image-resizer', {});

// Convert
expect('png to jpg', 'image-converter', { format: 'jpg' });
expect('convert png to jpg', 'image-converter', { format: 'jpg' });
expect('jpeg to webp', 'image-converter', { format: 'webp' });
expect('webp to png', 'image-converter', { format: 'png' });
expect('image to webp', 'image-converter', { format: 'webp' });
expect('png → jpeg', 'image-converter', { format: 'jpg' });
expect('png2jpg', 'image-converter', { format: 'jpg' });

// PDF
expect('merge pdf', 'merge-pdf');
expect('merge 2 pdfs', 'merge-pdf');
expect('combine two pdf files', 'merge-pdf');
expect('join pdf', 'merge-pdf');
expect('jpg to pdf', 'jpg-to-pdf');
expect('images to pdf', 'jpg-to-pdf');
expect('convert images to pdf', 'jpg-to-pdf');
expect('photos to pdf', 'jpg-to-pdf');
expect('compress pdf', 'compress-pdf');
expect('compress pdf to 2mb', 'compress-pdf', mb(2));
expect('pdf under 500kb', 'compress-pdf', kb(500));
expect('make pdf below 1mb', 'compress-pdf', mb(1));

// Single-action tools (no settings prefilled)
expect('crop photo', 'crop-image');
expect('crop image', 'crop-image');
expect('rotate image', 'rotate-image');
expect('flip photo', 'rotate-image');
expect('mirror selfie', 'rotate-image');
expect('watermark photo', 'watermark-image');
expect('remove exif', 'remove-image-metadata');
expect('remove photo location', 'remove-image-metadata');
expect('strip gps from image', 'remove-image-metadata');
expect('remove metadata', 'remove-image-metadata');
expect('image size', 'image-size-checker');
expect('check image size', 'image-size-checker');
expect('what is the size of my photo', 'image-size-checker');
expect('image size checker', 'image-size-checker');
expect('pdf to image', 'pdf-to-jpg');
expect('pdf to jpg', 'pdf-to-jpg');
expect('convert pdf to png', 'pdf-to-jpg');
expect('pdf to text', 'pdf-to-text');
expect('extract text from pdf', 'pdf-to-text');
expect('reorder pdf', 'organize-pdf');
expect('rearrange pdf pages', 'organize-pdf');
expect('reorder pages', 'organize-pdf');
expect('rotate pdf', 'rotate-pdf');
expect('crop pdf', 'crop-pdf');
expect('watermark pdf', 'watermark-pdf');
expect('add page numbers', 'page-numbers');
expect('add page numbers to pdf', 'page-numbers');
expect('split pdf', 'split-pdf');
expect('favicon generator', 'favicon-generator');
expect('make favicon from png', 'favicon-generator');
// ODT to PDF
expect('odt to pdf', 'odt-to-pdf');
expect('convert odt to pdf', 'odt-to-pdf');
expect('libreoffice document to pdf', 'odt-to-pdf');
expect('convert odt', 'odt-to-pdf');
expect('merge pdf and odt', 'merge-pdf');
assert.equal(buildIntentRoute(parseSearchIntent('odt to pdf')), '/odt-to-pdf/');
// Removed or unavailable tools are not faked.
for (const q of ['remove image background', 'remove background', 'word to pdf'])
  assert.notEqual(parseSearchIntent(q)?.tool, 'odt-to-pdf');
// Sizes and dimensions still win over the action words.
expect('image size 50kb', 'image-compressor', kb(50));
expect(
  'crop to 1080x1080',
  'image-resizer',
  { width: 1080, height: 1080 },
  false,
);
assert.equal(describeIntent(parseSearchIntent('rotate pdf')), '');
assert.equal(
  buildIntentRoute(parseSearchIntent('remove exif')),
  '/remove-image-metadata/',
);

// Ambiguous: leave it to the normal tool search.
for (const q of [
  'hello',
  '20kb',
  'photo',
  'something',
  '123',
  '',
  'png',
  'pdf',
  'to 20kb',
  'jpg',
])
  assert.equal(parseSearchIntent(q), null, `"${q}" should not route`);

// Routes and summaries
const route = (q) => buildIntentRoute(parseSearchIntent(q));
assert.equal(
  route('compress 50kb to 20kb'),
  '/compress-image/?targetSize=20&unit=KB',
);
assert.equal(
  route('resize image to 1080x1080'),
  '/resize-image/?width=1080&height=1080',
);
assert.equal(route('png to jpg'), '/convert-image/?format=jpg');
assert.equal(route('merge two pdfs'), '/merge-pdf/');
assert.equal(
  route('compress pdf to 2mb'),
  '/compress-pdf/',
  'PDF compressor has no size target',
);
assert.equal(
  buildIntentRoute(parseSearchIntent('png to jpg'), '/hi/convert-image/?x=1#a'),
  '/hi/convert-image/?format=jpg',
);
assert.equal(
  describeIntent(parseSearchIntent('compress 50kb to 20kb')),
  'Target: 20 KB',
);
assert.equal(
  describeIntent(parseSearchIntent('resize to 1080x1080')),
  '1080 × 1080 px',
);
assert.equal(describeIntent(parseSearchIntent('png to jpg')), 'Output: JPG');
assert.equal(
  describeIntent(parseSearchIntent('compress pdf to 2mb')),
  'Choose a compression level',
);
assert.equal(describeIntent(parseSearchIntent('merge pdf')), '');

// Destination pages never trust the URL.
assert.deepEqual(
  readToolParams('?targetSize=20&unit=kb', 'image-compressor'),
  kb(20),
);
assert.deepEqual(
  readToolParams('?targetSize=NaN&unit=KB', 'image-compressor'),
  {},
);
assert.deepEqual(readToolParams('?targetSize=-5', 'image-compressor'), {});
assert.deepEqual(
  readToolParams('?targetSize=99&unit=GB', 'image-compressor'),
  {},
);
assert.deepEqual(
  readToolParams('?targetSize=500&unit=MB', 'image-compressor'),
  {},
);
assert.deepEqual(readToolParams('?width=1080&height=0', 'image-resizer'), {
  width: 1080,
});
assert.deepEqual(readToolParams('?width=1.5&height=abc', 'image-resizer'), {});
assert.deepEqual(
  readToolParams('?width=1080&height=1080', 'image-compressor'),
  {},
  'compressor ignores dimensions',
);
assert.deepEqual(readToolParams('?format=JPEG', 'image-converter'), {
  format: 'jpg',
});
assert.deepEqual(readToolParams('?format=exe', 'image-converter'), {});
assert.deepEqual(readToolParams('', 'merge-pdf'), {});

console.log(
  'PASS: search intents (compress, resize, convert, PDF, ODT, single-action tools), ambiguous input, routes, summaries and URL validation.',
);
