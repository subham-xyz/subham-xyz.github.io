"""Builds the Loki favicons from the existing brand masters.

  public/brand/kittysuite-dark.png   dark badge  -> shown on light browser/site themes
  public/brand/kittysuite-light.png  light badge -> shown on dark browser/site themes

Outputs (all from those two files, nothing invented):
  public/brand/loki-favicon-dark.png   64x64, dark badge
  public/brand/loki-favicon-light.png  64x64, light badge
  public/favicon.svg                   both badges, switches with prefers-color-scheme (no-JS fallback)
  public/favicon.ico                   16/32/48, dark badge (legacy browsers, search results)

The site's own theme toggle swaps the <link data-kitty-favicon> href between the two
PNGs at runtime (see Layout.astro and site.ts). Run: python scripts/build-favicons.py
"""
import base64
import io
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / 'public' / 'brand'


def badge(name: str) -> Image.Image:
    src = Image.open(BRAND / name).convert('RGBA')
    # Crop to the round badge (the masters have ~15% transparent padding), keeping it square
    # and centred so Loki fills the icon without clipping the edge of the disc.
    box = src.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
    cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
    half = max(box[2] - box[0], box[3] - box[1]) / 2 + 2
    return src.crop((round(cx - half), round(cy - half), round(cx + half), round(cy + half)))


def sized(img: Image.Image, size: int) -> Image.Image:
    out = img.resize((size, size), Image.LANCZOS)
    # A light sharpen keeps the ears and eyes readable at 16-32 px.
    return out.filter(ImageFilter.UnsharpMask(radius=0.6, percent=60, threshold=2)) if size <= 64 else out


def png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, 'PNG', optimize=True)
    return buf.getvalue()


dark, light = badge('kittysuite-dark.png'), badge('kittysuite-light.png')
dark64, light64 = sized(dark, 64), sized(light, 64)
(BRAND / 'loki-favicon-dark.png').write_bytes(png_bytes(dark64))
(BRAND / 'loki-favicon-light.png').write_bytes(png_bytes(light64))

b64 = lambda img: base64.b64encode(png_bytes(img)).decode()
svg = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
    '<style>.l{display:none}@media (prefers-color-scheme:dark){.d{display:none}.l{display:inline}}</style>'
    f'<image class="d" width="64" height="64" href="data:image/png;base64,{b64(dark64)}"/>'
    f'<image class="l" width="64" height="64" href="data:image/png;base64,{b64(light64)}"/>'
    '</svg>'
)
(ROOT / 'public' / 'favicon.svg').write_text(svg, encoding='utf-8')

ico = sized(dark, 48)
ico.save(ROOT / 'public' / 'favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])
print('favicons written')
