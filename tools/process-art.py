#!/usr/bin/env python3
"""
process-art.py — turns the raw art in assets/source/ into game-ready tiles.

Originals are never modified. Re-run this any time you replace a source file
or want to nudge a crop:

    python3 tools/process-art.py

Region crests
  The source crests are already gold on transparency, so the work is: trim the
  empty margin, pad to a square (the renderer draws tiles square and would
  otherwise stretch them), add a dark drop shadow so gold stays legible on the
  gold-ish Shurima tile, and write a 128x128 PNG.

Champion portraits
  The sources are wide splash arts. Each entry below says where that
  champion's head is, as a fraction of the image, and how much of the image
  height the crop should span. Tweak those three numbers to re-frame a
  portrait — that is the only thing you need to touch.
"""
import os
from PIL import Image, ImageFilter, ImageEnhance

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'assets', 'source')
OUT_REGIONS = os.path.join(ROOT, 'assets', 'regions')
OUT_CHAMPS = os.path.join(ROOT, 'assets', 'champions')

TILE = 128  # output size; tiles render at ~26px, so this is plenty

# region key -> source filename
REGIONS = {
    'noxus':       'noxus_crest_icon.png',
    'demacia':     'demacia_crest_icon.png',
    'shadowIsles': 'shadow_isles_crest_icon.png',
    'ionia':       'iona_crest_icon.png',
    'shurima':     'shurima_crest_icon.png',
    'zaun':        'zaun_crest_icon.png',
    'void':        'void_crest_icon.png',
    'freljord':    'freljord_crest_icon.png',
    'bilgewater':  'bilgewater_crest_icon.png',
    'bandleCity':  'bandle_city_crest_icon.png',
    'ixtal':       'ixtal_crest_icon.png',
    'targon':      'mt_targon_crest_icon.png',
    'piltover':    'piltover_crest_icon.png',
}

# champion key -> (source, head_x, head_y, crop_height)
#   head_x / head_y : where the head sits, as a fraction of image width/height
#   crop_height     : side of the square crop, as a fraction of image height
# crop_height is scaled per champion so every head ends up roughly the same
# size in its tile — Darius is painted much closer to camera than Sejuani, so
# a single shared value would make him a nostril and her a speck.
CHAMPIONS = {
    'ahri':        ('Ahri.jpg',         0.555, 0.200, 0.32),
    'darius':      ('Darius.jpg',       0.530, 0.180, 0.36),
    'kaisa':       ('Kaisa.jpg',        0.498, 0.180, 0.32),
    'sejuani':     ('Sejuani.jpg',      0.540, 0.180, 0.19),
    'sivir':       ('Sivir.jpg',        0.533, 0.136, 0.22),
    'twitch':      ('Twitch.jpg',       0.658, 0.331, 0.22),
    'kayle':       ('kayle.jpg',        0.715, 0.260, 0.20),
    'gwen':        ('gwen.jpg',         0.500, 0.135, 0.24),
    'pyke':        ('pyke.jpg',         0.530, 0.400, 0.35),
    'teemo':       ('teemo.jpg',        0.475, 0.270, 0.52),
    'qiyana':      ('kyana.jpg',        0.515, 0.225, 0.28),
    'aurelionSol': ('aurelion-sol.jpg', 0.575, 0.150, 0.32),
    'caitlyn':     ('kaitlyn.jpg',      0.710, 0.230, 0.20),
}


def process_region(src_path, out_path):
    im = Image.open(src_path).convert('RGBA')

    # Trim fully transparent margins so every crest fills its tile equally.
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)

    # Scale to fit a square with a little breathing room, keeping aspect.
    inner = int(TILE * 0.84)
    scale = min(inner / im.width, inner / im.height)
    im = im.resize((max(1, round(im.width * scale)),
                    max(1, round(im.height * scale))), Image.LANCZOS)

    # Lift the gold a touch — the source is a mid tone and the tiles behind it
    # are muted, so a little extra brightness keeps the crest forward.
    im = ImageEnhance.Brightness(im).enhance(1.18)

    canvas = Image.new('RGBA', (TILE, TILE), (0, 0, 0, 0))
    pos = ((TILE - im.width) // 2, (TILE - im.height) // 2)

    # Dark drop shadow built from the alpha channel. This is what keeps the
    # gold crest readable on Shurima's gold tile.
    alpha = im.split()[3]

    # A tight dark outline first, then a soft shadow under it. The outline is
    # what makes a gold crest survive on the yellow-ish tiles (Shurima,
    # Bandle City); blur alone washes out against them.
    outline = Image.new('RGBA', (TILE, TILE), (0, 0, 0, 0))
    outline.paste((0, 0, 0, 235), pos, alpha)
    outline = outline.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1))
    canvas.alpha_composite(outline)

    shadow = Image.new('RGBA', (TILE, TILE), (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 150), pos, alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(4))
    canvas.alpha_composite(shadow, (0, 3))

    canvas.alpha_composite(im, pos)
    canvas.save(out_path)
    return canvas


def process_champion(src_path, out_path, hx, hy, ch):
    im = Image.open(src_path).convert('RGB')
    w, h = im.size

    side = int(h * ch)
    cx, cy = int(w * hx), int(h * hy)
    left, top = cx - side // 2, cy - side // 2

    # Keep the crop inside the image rather than letting it run off an edge.
    left = max(0, min(left, w - side))
    top = max(0, min(top, h - side))

    im = im.crop((left, top, left + side, top + side)).resize((TILE, TILE), Image.LANCZOS)

    # Splash art is painterly and dark; a little contrast and saturation helps
    # it survive being shrunk to a 26px tile.
    im = ImageEnhance.Contrast(im).enhance(1.12)
    im = ImageEnhance.Color(im).enhance(1.10)

    im.convert('RGBA').save(out_path)
    return im


def main():
    os.makedirs(OUT_REGIONS, exist_ok=True)
    os.makedirs(OUT_CHAMPS, exist_ok=True)

    for key, fname in REGIONS.items():
        src = os.path.join(SRC, 'regions', fname)
        if not os.path.exists(src):
            print('  missing source, skipped: %s' % src)
            continue
        process_region(src, os.path.join(OUT_REGIONS, key + '.png'))
        print('  region   %-9s <- %s' % (key, fname))

    for key, (fname, hx, hy, ch) in CHAMPIONS.items():
        src = os.path.join(SRC, 'champions', fname)
        if not os.path.exists(src):
            print('  missing source, skipped: %s' % src)
            continue
        process_champion(src, os.path.join(OUT_CHAMPS, key + '.png'), hx, hy, ch)
        print('  champion %-9s <- %s  head=(%.2f, %.2f) crop=%.2f' % (key, fname, hx, hy, ch))


if __name__ == '__main__':
    main()
