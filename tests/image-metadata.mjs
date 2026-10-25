// Byte-level tests for the metadata reader used by Image Size Checker and
// Remove Image Metadata. Run: node tests/image-metadata.mjs
import assert from 'node:assert/strict';
import {
  readMetadata,
  sniffFormat,
  describeMetadata,
  hasPersonalMetadata,
  aspectRatio,
} from '../src/scripts/image-metadata.mjs';

const enc = (s) => [...s].map((c) => c.charCodeAt(0));
const u16 = (n) => [n & 255, n >> 8];
const u32 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, n >>> 24];
const entry = (tag, type, count, value) => [
  ...u16(tag),
  ...u16(type),
  ...u32(count),
  ...value,
];

// Little-endian TIFF: IFD0 {Make -> "Canon EOS", Orientation 6, GPS pointer}, GPS IFD {version, LatRef}.
function tiff({ gps = true } = {}) {
  const make = enc('Canon EOS\0');
  const ifd0At = 8,
    count = gps ? 3 : 2;
  const ifd0Size = 2 + count * 12 + 4;
  const makeAt = ifd0At + ifd0Size,
    gpsAt = makeAt + make.length;
  const ifd0 = [
    ...u16(count),
    ...entry(0x010f, 2, make.length, u32(makeAt)),
    ...entry(0x0112, 3, 1, [6, 0, 0, 0]),
    ...(gps ? entry(0x8825, 4, 1, u32(gpsAt)) : []),
    ...u32(0),
  ];
  const gpsIfd = [
    ...u16(2),
    ...entry(0, 1, 4, [2, 3, 0, 0]),
    ...entry(1, 2, 2, [...enc('N\0'), 0, 0]),
    ...u32(0),
  ];
  return [
    ...enc('II'),
    ...u16(42),
    ...u32(ifd0At),
    ...ifd0,
    ...make,
    ...(gps ? gpsIfd : []),
  ];
}
const segment = (marker, body) => [
  0xff,
  marker,
  (body.length + 2) >> 8,
  (body.length + 2) & 255,
  ...body,
];
const jpeg = (...segments) =>
  new Blob([
    new Uint8Array([
      0xff,
      0xd8,
      ...segments.flat(),
      0xff,
      0xda,
      0,
      2,
      0xff,
      0xd9,
    ]),
  ]);

const full = await readMetadata(
  jpeg(
    segment(0xe1, [...enc('Exif\0\0'), ...tiff()]),
    segment(0xe1, enc('http://ns.adobe.com/xap/1.0/\0<x/>')),
  ),
);
assert.equal(full.format, 'JPEG');
assert.ok(full.exif && full.gps && full.xmp);
assert.equal(full.fields.make, 'Canon EOS');
assert.equal(full.fields.orientation, 6);
assert.ok(describeMetadata(full).includes('GPS location'));
assert.ok(hasPersonalMetadata(full));

const noGps = await readMetadata(
  jpeg(segment(0xe1, [...enc('Exif\0\0'), ...tiff({ gps: false })])),
);
assert.ok(noGps.exif && !noGps.gps);

const clean = await readMetadata(
  jpeg(segment(0xe0, enc('JFIF\0\x01\x01\0\0\x01\0\x01\0\0'))),
);
assert.ok(!hasPersonalMetadata(clean));
assert.deepEqual(describeMetadata(clean), []);

// PNG with a tEXt chunk, then IDAT.
const be32 = (n) => [n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255];
const pngChunk = (type, data) => [
  ...be32(data.length),
  ...enc(type),
  ...data,
  0,
  0,
  0,
  0,
];
const png = new Blob([
  new Uint8Array([
    0x89,
    ...enc('PNG\r\n\x1a\n'),
    ...pngChunk('IHDR', new Array(13).fill(0)),
    ...pngChunk('tEXt', enc('Author\0Me')),
    ...pngChunk('IDAT', [0]),
    ...pngChunk('IEND', []),
  ]),
]);
const pngReport = await readMetadata(png);
assert.equal(pngReport.format, 'PNG');
assert.ok(pngReport.text && !pngReport.exif);

// Truncated garbage never throws.
const junk = await readMetadata(
  new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 1, 2])]),
);
assert.equal(junk.format, 'JPEG');

assert.equal(
  sniffFormat(new Uint8Array([...enc('RIFF'), 0, 0, 0, 0, ...enc('WEBP')])),
  'WebP',
);
assert.equal(aspectRatio(1920, 1080), '16:9');
assert.equal(aspectRatio(4000, 3000), '4:3');
assert.equal(aspectRatio(1001, 997), '1.00:1');
console.log('image-metadata: all checks passed');
