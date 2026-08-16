#!/usr/bin/env python3
"""
export-blocks.py — one image per region, for assembling mockups by hand.

    python3 tools/export-blocks.py            512px JPGs into assets/blocks/
    python3 tools/export-blocks.py --size 256
    python3 tools/export-blocks.py --png      also write transparent PNGs

Each tile is drawn the way src/render.js draws it in the game — same colour,
same top-to-bottom gradient, same specular sweep across the top, same rounded
corners and crest inset — so a mockup assembled from these looks like a real
board rather than an approximation.

The padding around the tile is symmetric, so the images butt together edge to
edge without seams: drop them on a grid at whatever size and the gaps line up
the way they do in play.
"""
import argparse
import json
import os
import re

from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CONFIG = os.path.join(ROOT, 'src', 'config.js')
CREST_DIR = os.path.join(ROOT, 'assets', 'regions')
OUT_DIR = os.path.join(ROOT, 'assets', 'blocks')

# The board bed behind a tile. JPG has no transparency, so the padding has to
# be filled with something; this is the colour it sits on in game.
BED = (12, 17, 26)


def read_regions():
    """Pull the region table straight out of config.js so this can never drift
    from the colours the game actually uses."""
    src = open(CONFIG, encoding='utf-8').read()
    block = src.split('LOL.REGIONS = {', 1)[1].split('\n};', 1)[0]

    regions = []
    pattern = re.compile(
        r"(\w+):\s*\{[^}]*?name:\s*'([^']+)'[^}]*?color:\s*'(#[0-9a-fA-F]{6})'",
        re.S)
    for key, name, color in pattern.findall(block):
        regions.append({'key': key, 'name': name, 'color': color})
    return regions


def hex_to_rgb(value):
    value = value.lstrip('#')
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def shade(rgb, amount):
    """Same curve as the `shade` helper in render.js."""
    out = []
    for v in rgb:
        if amount > 0:
            out.append(v + (255 - v) * amount)
        else:
            out.append(v * (1 + amount))
        out[-1] = max(0, min(255, int(round(out[-1]))))
    return tuple(out)


def vertical_gradient(size, stops):
    """stops: [(position 0..1, rgb), ...] in ascending position."""
    img = Image.new('RGB', (1, size))
    px = img.load()
    for y in range(size):
        t = y / max(1, size - 1)
        lo = stops[0]
        hi = stops[-1]
        for i in range(len(stops) - 1):
            if stops[i][0] <= t <= stops[i + 1][0]:
                lo, hi = stops[i], stops[i + 1]
                break
        span = max(1e-6, hi[0] - lo[0])
        f = (t - lo[0]) / span
        px[0, y] = tuple(int(round(lo[1][c] + (hi[1][c] - lo[1][c]) * f)) for c in range(3))
    return img.resize((size, size))


def rounded_mask(size, box, radius):
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(box, radius=radius, fill=255)
    return mask


def render_tile(region, size, crest_path):
    base = hex_to_rgb(region['color'])

    # Proportions copied from render.js: 4.5% padding, 14% corner radius,
    # 8% crest inset.
    pad = max(1, round(size * 0.045))
    s = size - pad * 2
    radius = round(size * 0.14)
    box = (pad, pad, pad + s - 1, pad + s - 1)

    tile = Image.new('RGBA', (size, size), BED + (255,))

    # Face: light at the top, base in the middle, dark at the bottom.
    face = vertical_gradient(size, [
        (0.00, shade(base, 0.30)),
        (0.52, base),
        (1.00, shade(base, -0.34)),
    ]).convert('RGBA')
    tile.paste(face, (0, 0), rounded_mask(size, box, radius))

    # Specular sweep across the top third.
    gloss_h = int(s * 0.42)
    gloss = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    gdraw = ImageDraw.Draw(gloss)
    gx0 = pad + int(s * 0.06)
    gy0 = pad + int(s * 0.05)
    gdraw.rounded_rectangle(
        (gx0, gy0, gx0 + int(s * 0.88), gy0 + gloss_h),
        radius=int(radius * 0.8), fill=(255, 255, 255, 255))
    ramp = Image.new('L', (1, size))
    rpx = ramp.load()
    for y in range(size):
        # Fades out over the top half of the tile, as the canvas gradient does.
        t = max(0.0, 1.0 - (y - gy0) / max(1.0, s * 0.5))
        rpx[0, y] = int(max(0, min(255, 0.34 * 255 * t)))
    gloss.putalpha(Image.composite(ramp.resize((size, size)),
                                   Image.new('L', (size, size), 0),
                                   gloss.split()[3]))
    tile.alpha_composite(gloss)

    # Crest, already carrying its dark outline from process-art.py.
    if os.path.exists(crest_path):
        inset = int(s * 0.08)
        art = Image.open(crest_path).convert('RGBA')
        side = s - inset * 2
        art = art.resize((side, side), Image.LANCZOS)
        tile.alpha_composite(art, (pad + inset, pad + inset))

    # Edges. In game these are hairlines at any cell size, so they are kept
    # thin here rather than scaled up 16x into heavy black bars.
    edge = max(2, round(size * 0.006))
    draw = ImageDraw.Draw(tile)
    draw.rounded_rectangle(box, radius=radius, outline=(0, 0, 0, 115), width=edge)
    draw.rounded_rectangle(
        (box[0] + edge, box[1] + edge, box[2] - edge, box[3] - edge),
        radius=int(radius * 0.9), outline=(255, 255, 255, 26), width=max(1, edge // 2))

    return tile


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--size', type=int, default=512)
    ap.add_argument('--png', action='store_true', help='also write transparent PNGs')
    ap.add_argument('--quality', type=int, default=95)
    args = ap.parse_args()

    os.makedirs(OUT_DIR, exist_ok=True)
    regions = read_regions()
    if not regions:
        raise SystemExit('No regions found in src/config.js')

    sheet_cols = 5
    sheet_rows = (len(regions) + sheet_cols - 1) // sheet_cols
    thumb = 200
    sheet = Image.new('RGB', (sheet_cols * thumb, sheet_rows * thumb), BED)

    for i, region in enumerate(regions):
        crest = os.path.join(CREST_DIR, region['key'] + '.png')
        tile = render_tile(region, args.size, crest)

        jpg_path = os.path.join(OUT_DIR, region['key'] + '.jpg')
        tile.convert('RGB').save(jpg_path, 'JPEG', quality=args.quality,
                                 subsampling=0, optimize=True)

        if args.png:
            transparent = tile.copy()
            # Knock the bed out so the corners are see-through.
            pad = max(1, round(args.size * 0.045))
            s = args.size - pad * 2
            mask = rounded_mask(args.size, (pad, pad, pad + s - 1, pad + s - 1),
                                round(args.size * 0.14))
            transparent.putalpha(mask)
            transparent.save(os.path.join(OUT_DIR, region['key'] + '.png'))

        sheet.paste(tile.convert('RGB').resize((thumb, thumb), Image.LANCZOS),
                    ((i % sheet_cols) * thumb, (i // sheet_cols) * thumb))

        print('  %-12s %s  %s' % (region['key'], region['color'],
                                  os.path.relpath(jpg_path, ROOT)))

    sheet.save(os.path.join(OUT_DIR, '_all-regions.jpg'), 'JPEG', quality=92)
    print('\n  %d blocks at %dpx, plus _all-regions.jpg' % (len(regions), args.size))


if __name__ == '__main__':
    main()
