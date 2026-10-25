"""Add Bold and Italic styles of the indexed families to the self-hosted font index.

For every family already in public/font-index/manifest.json this fetches the family's
OFL source files from github.com/google/fonts (build time only), takes the real Bold
(weight 700, or the variable font instanced at 700) and Italic (weight 400 italic)
when the family has them, subsets them to Latin, renames internal names to
"KittySuite Index <slug> <Style>" (OFL reserved names), and writes:

  public/font-index/<slug>-bold.woff2, <slug>-italic.woff2
  public/font-index/glyphs-bold.bin.gz, glyphs-italic.bin.gz  (same 208-byte records
      as glyphs.bin.gz, one block per entry, in manifest order)
  manifest.json "styles": {"bold": [{"font": i, "id", "url", "weight"}], "italic": [...]}

Run: python scripts/build-font-styles.py   (needs fonttools, brotli, Pillow)
Source downloads are cached in .font-build/ (git-ignored).
"""
from pathlib import Path
import concurrent.futures, gzip, hashlib, io, json, re, struct, time, urllib.parse, urllib.request
from fontTools.ttLib import TTFont
from fontTools.subset import Options, Subsetter
from fontTools.varLib.instancer import instantiateVariableFont
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/font-index'
CACHE = ROOT / '.font-build/styles'
CACHE.mkdir(parents=True, exist_ok=True)
SIZE = 80
BASE = 'https://raw.githubusercontent.com/google/fonts/main/ofl/'


def fetch(url, cache_name):
    path = CACHE / cache_name
    if path.exists():
        return path.read_bytes()
    for attempt in range(3):
        try:
            data = urllib.request.urlopen(
                urllib.request.Request(url, headers={'User-Agent': 'KittySuite font index builder'}), timeout=60
            ).read()
            path.write_bytes(data)
            return data
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def parse_metadata(text):
    blocks = []
    for block in re.findall(r'fonts\s*\{(.*?)\n\}', text, re.S):
        style = re.search(r'style: "(\w+)"', block)
        weight = re.search(r'weight: (\d+)', block)
        filename = re.search(r'filename: "([^"]+)"', block)
        if style and weight and filename:
            blocks.append({'style': style.group(1), 'weight': int(weight.group(1)), 'file': filename.group(1)})
    axes = {m.group(1): (float(m.group(2)), float(m.group(3)))
            for m in re.finditer(r'axes\s*\{\s*tag: "(\w+)"\s*min_value: ([\d.]+)\s*max_value: ([\d.]+)', text)}
    return blocks, axes


def pick(blocks, axes, style):
    """(filename, weight) for the wanted style, or None when the family lacks it."""
    want_style, want_weight = ('normal', 700) if style == 'bold' else ('italic', 400)
    candidates = [b for b in blocks if b['style'] == want_style]
    exact = [b for b in candidates if b['weight'] == want_weight]
    if exact:
        return exact[0]['file'], want_weight
    variable = [b for b in candidates if '[' in b['file']]
    lo, hi = axes.get('wght', (400, 400))
    if variable and lo <= want_weight <= hi:
        return variable[0]['file'], want_weight
    if style == 'bold':
        heavy = [b for b in candidates if 600 <= b['weight'] <= 800 and '[' not in b['file']]
        if heavy:
            best = min(heavy, key=lambda b: abs(b['weight'] - 700))
            return best['file'], best['weight']
    else:
        near = [b for b in candidates if 300 <= b['weight'] <= 500 and '[' not in b['file']]
        if near:
            best = min(near, key=lambda b: abs(b['weight'] - 400))
            return best['file'], best['weight']
    return None


def prepare(raw, weight, slug, style):
    font = TTFont(io.BytesIO(raw))
    cmap = font.getBestCmap()
    if any(ord(c) not in cmap for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'):
        return None
    if 'fvar' in font:
        axes = {a.axisTag: (weight if a.axisTag == 'wght' else a.defaultValue) for a in font['fvar'].axes}
        font = instantiateVariableFont(font, axes, inplace=True)
    subset = Subsetter(options=Options())
    subset.populate(unicodes=range(32, 592))
    subset.subset(font)
    label = style.capitalize()
    family = f'KittySuite Index {slug} {label}'
    names = {1: family, 2: 'Regular', 3: f'KittySuiteIndex-{slug}-{label}', 4: family,
             6: f'KittySuiteIndex-{slug}-{label}', 16: family, 17: 'Regular'}
    for record in font['name'].names:
        if record.nameID in names:
            record.string = names[record.nameID].encode(record.getEncoding(), errors='replace')
    for nid in (21, 22, 25):
        font['name'].removeNames(nameID=nid)
    font.flavor = None
    ttf = io.BytesIO()
    font.save(ttf)
    return font, ttf.getvalue()


def features(ttf_bytes, chars):
    face = ImageFont.truetype(io.BytesIO(ttf_bytes), SIZE)
    ascent = face.getmetrics()[0]
    data = bytearray()
    for c in chars:
        box = face.getbbox(c)
        w, h = max(1, box[2] - box[0]), max(1, box[3] - box[1])
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


def build(job):
    index, record, chars = job
    slug = record['id']
    try:
        meta = fetch(BASE + slug + '/METADATA.pb', f'{slug}.METADATA.pb').decode()
    except Exception as error:
        return index, {}, f'{slug}: metadata {str(error)[:60]}'
    blocks, axes = parse_metadata(meta)
    out = {}
    for style in ('bold', 'italic'):
        choice = pick(blocks, axes, style)
        if not choice:
            continue
        filename, weight = choice
        try:
            raw = fetch(BASE + slug + '/' + urllib.parse.quote(filename), f'{slug}-{filename}')
            prepared = prepare(raw, weight, slug, style)
            if not prepared:
                continue
            font, ttf = prepared
            font.flavor = 'woff2'
            target = OUT / f'{slug}-{style}.woff2'
            font.save(target)
            out[style] = {
                'font': index,
                'id': f'{slug}-{style}',
                'url': f'/font-index/{slug}-{style}.woff2',
                'weight': weight,
                'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                'data': features(ttf, chars),
            }
        except Exception as error:
            print('skip', slug, style, str(error)[:80], flush=True)
    return index, out, None


manifest = json.loads((OUT / 'manifest.json').read_text(encoding='utf-8'))
chars = manifest['characters']
jobs = [(i, record, chars) for i, record in enumerate(manifest['fonts'])]
results = {}
with concurrent.futures.ThreadPoolExecutor(max_workers=24) as pool:
    for done, (index, out, error) in enumerate(pool.map(build, jobs), 1):
        results[index] = out
        if error:
            print('skip', error, flush=True)
        if done % 100 == 0:
            print('processed', done, flush=True)
styles = {}
for style in ('bold', 'italic'):
    entries = [results[i][style] for i in sorted(results) if style in results[i]]
    (OUT / f'glyphs-{style}.bin.gz').write_bytes(
        gzip.compress(b''.join(e.pop('data') for e in entries), compresslevel=9, mtime=0))
    styles[style] = entries
    print(style, len(entries), 'entries', (OUT / f'glyphs-{style}.bin.gz').stat().st_size, 'bytes', flush=True)
manifest['styles'] = styles
manifest['version'] = 3
(OUT / 'manifest.json').write_text(json.dumps(manifest, separators=(',', ':')), encoding='utf-8')
print('COMPLETE', flush=True)
