"""Rebuild public/font-index/glyphs.bin.gz from the self-hosted index fonts (no network).

Each record (stride 208 bytes) per font and character holds:
  192 bytes  12 x 16 ink-coverage bitmap of the glyph's ink box (quantized to 15 levels)
  float32    ink width / ink height
  float32    advance width / em
  float32    ink height / em          (added in v2: relative letter heights)
  float32    ink top above baseline / em
Run: python scripts/rebuild-font-features.py   (needs fonttools, brotli, Pillow)
"""
from pathlib import Path
import io, json, gzip, struct, concurrent.futures
from fontTools.ttLib import TTFont
from PIL import Image, ImageFont, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/font-index'
SIZE = 80
STRIDE = 208


def features(record, chars):
    font = TTFont(OUT / (record['id'] + '.woff2'))
    font.flavor = None
    ttf = io.BytesIO()
    font.save(ttf)
    face = ImageFont.truetype(io.BytesIO(ttf.getvalue()), SIZE)
    ascent = face.getmetrics()[0]
    data = bytearray()
    for c in chars:
        box = face.getbbox(c)
        w = max(1, box[2] - box[0])
        h = max(1, box[3] - box[1])
        img = Image.new('L', (w, h))
        ImageDraw.Draw(img).text((-box[0], -box[1]), c, font=face, fill=255)
        ink = img.getbbox()
        top, bottom = box[1], box[1] + h
        if ink:
            img = img.crop(ink)
            top, bottom = box[1] + ink[1], box[1] + ink[3]
        data.extend(bytes(round(v / 17) * 17 for v in img.resize((12, 16), Image.Resampling.BOX).tobytes()))
        data.extend(struct.pack('<ffff', img.width / img.height, face.getlength(c) / SIZE,
                                (bottom - top) / SIZE, (ascent - top) / SIZE))
    return bytes(data)


manifest = json.loads((OUT / 'manifest.json').read_text(encoding='utf-8'))
chars = manifest['characters']
with concurrent.futures.ProcessPoolExecutor() as pool:
    blobs = list(pool.map(features, manifest['fonts'], [chars] * len(manifest['fonts']), chunksize=8))
manifest['version'] = 2
manifest['stride'] = STRIDE
(OUT / 'manifest.json').write_text(json.dumps(manifest, separators=(',', ':')), encoding='utf-8')
(OUT / 'glyphs.bin.gz').write_bytes(gzip.compress(b''.join(blobs), compresslevel=9, mtime=0))
print('COMPLETE', len(blobs), 'families', (OUT / 'glyphs.bin.gz').stat().st_size, 'bytes')
