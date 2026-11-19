#!/usr/bin/env python3
"""Bake the cast's hair strand maps (strand normal, strand direction, hairline coverage) from MPFB's hair assets.

The people GLBs' hair meshes are the MPFB hair meshes with their original UVs (checked: triangle counts and UV bounds
match the .obj files exactly), so a map painted in the asset's UV space lands on the GLB's hair unchanged.

  python3 tools/people/bake-hair-maps.py [--verify] [--stats] [--out DIR]

Source: MPFB's data/hair/<cut>/ (the .obj for the UVs and the open scalp edges, the diffuse PNG for the painted strands).
Set MPFB_HAIR to the data/hair folder if it is not at the default below.

Format (the same for every atlas): 2048 x 1024, eight 512 px tiles (4 px guard band each, so 504 px of map), row by row.
  hair-fibres*.webp  strand normal (lossless)         recipe: log-luminance high-pass of the diffuse, gradient -> normal
  hair-flow*.webp    strand direction (rg = cos/sin of the lock's angle, b = coherence * alpha)
  hairline*.webp     scalp-edge coverage (grey), the soft front edge of the hair cap
Atlas 1 (no suffix) is the first eight cuts and ships as baked by the original pass: this script reproduces it (--verify).
Atlases 2.. hold the other cuts; the manifest media-cast-hair-atlas.mjs says which cut is on which tile of which atlas.
New cuts' normal strength is matched to the first eight's (gain per cut, see GAIN_*), so a room that mixes them looks even.
"""
import argparse, json, os, sys
from collections import defaultdict
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = Path(os.environ.get('MPFB_HAIR', '/home/ergo/blender/mpfb-user/extensions/.user/user_default/mpfb/data/hair'))
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/rooms/media'

# The original atlas (suffix ''): its order is what media-cast-finishes.mjs always used.
FIRST = ['ponytail01', 'afro01', 'short01', 'short04', 'braid01', 'short02', 'bob01', 'long01']
# Added by the all-hairstyles pass, most-used first (people GLB hair material 'Human.<cut>'; tile i of atlas 2, 3, ...).
# cut -> diffuse PNG inside its MPFB folder (the painted strands: colour does not matter, only the structure). The six
# toigo bobs share one painted atlas (same alpha, same strokes, only the colour differs), so the two inverted bobs, whose
# own colours are near-black and too dark to carry a gradient, read their strokes from a mid-tone sibling.
MORE = [
    ('cortu_short_messy_hair', 'short_messy_diff.png'),
    ('rehmanpolanski_hair_bun_brown', 'Hair_bun_brown.png'),
    ('culturalibre_hair_02', 'male02_diffuse_black.png'),
    ('culturalibre_hair_01', 'diffuse_black.png'),
    ('toigo_curled_under_bob', 'GingerHair.png'),
    ('toigo_blunt_bob_with_bangs', 'AuburnHair.png'),
    ('short03', 'short03_diffuse.png'),
    ('elvs_double_mh_braid', 'braid01_diffuse_black.png'),
    ('cortu_strawberry_cloud_hair', 'strawberry_cloud_diff.png'),
    ('elvs_french_braid_variation', 'braid01_diffuse_mahogany.png'),
    ('elvs_unkempt_french_braid', 'braid01_diffuse_brightginger.png'),
    ('toigo_blunt_bob', 'StrawberryBlondHair.png'),
    ('elvs_reverse_french_braid_bun', 'braid01_diffuse_grapewash.png'),
    ('toigo_curled_under_bob_with_bangs', 'BlondHair.png'),
    ('toigo_inverted_bob_with_bangs', '../toigo_blunt_bob_with_bangs/AuburnHair.png'),
    ('toigo_inverted_bob', '../toigo_blunt_bob_with_bangs/AuburnHair.png'),
]
PER_ATLAS = 8
EDGE_MAX = .12

def lum(im): return np.asarray(im.convert('L'), dtype=np.float32) / 255
def norm(dx, dy):
    n = np.stack([-dx, dy, np.ones_like(dx)], axis=2); n /= np.linalg.norm(n, axis=2)[:, :, None]
    return Image.fromarray(np.uint8(np.clip(n * 127.5 + 127.5, 0, 255)))
def smooth(v, r):
    return np.asarray(Image.fromarray(np.uint8(np.clip(v * .5 + .5, 0, 1) * 255)).filter(ImageFilter.GaussianBlur(r)), dtype=np.float32) / 127.5 - 1
def jpg(a): return Image.fromarray(np.uint8(np.clip(a, 0, 1) * 255))
def diffuse(folder, name=None):
    path = folder / name if name else next(folder.glob('*diffuse*.png'))
    return Image.open(path).convert('RGBA').resize((504, 504), Image.Resampling.LANCZOS)

def strand_tiles(img, gain=1.0):
    """normal tile, direction tile and the alpha-weighted slope the normal carries, from one diffuse image."""
    l = lum(img); alpha = np.asarray(img.getchannel('A'), dtype=np.float32) / 255
    h = (np.log(.045 + l) - np.log(.045 + lum(img.convert('L').filter(ImageFilter.GaussianBlur(3))))) * alpha
    dy, dx = np.gradient(h); n = norm(dx * 1.85 * gain, dy * 1.85 * gain)
    # The principal tangent follows the locks across the artist's original UVs.
    tx = dx * dx - dy * dy; ty = 2 * dx * dy; scale = max(.01, np.percentile(np.abs(tx), 99))
    a = smooth(tx / scale, 2); b = smooth(ty / scale, 2)
    angle = .5 * np.arctan2(b, a) + np.pi / 2
    d = jpg(np.stack([.5 + .5 * np.cos(angle), .5 + .5 * np.sin(angle), np.clip(np.hypot(a, b) * 3, .12, .92) * alpha], axis=2))
    slope = float(np.sqrt((alpha * (dx * dx + dy * dy)).sum() / max(alpha.sum(), 1)) * 1.85)
    return n, d, slope

def hairline_tile(folder, cut, img):
    P = []; UV = []; E = defaultdict(list)
    for line in (folder / (next(folder.glob('*.obj')).name)).read_text().splitlines():
        a = line.split()
        if a[:1] == ['v']: P.append(list(map(float, a[1:4])))
        if a[:1] == ['vt']: UV.append([float(a[1]), 1 - float(a[2])])
        if a[:1] == ['f']:
            vs = [tuple(int(n) - 1 for n in v.split('/')[:2]) for v in a[1:]]
            for v, w in zip(vs, vs[1:] + vs[:1]): E[tuple(sorted((v[0], w[0])))].append((v, w))
    P = np.array(P); UV = np.array(UV) * 504
    mask = Image.new('L', (504, 504), 255); draw = ImageDraw.Draw(mask); segments = []
    for (a, b), edges in E.items():
        if len(edges) != 1: continue
        mid = (P[a] + P[b]) / 2
        if mid[1] < P[:, 1].max() - 1.38 or mid[2] < P[:, 2].max() - 1.0: continue
        v, w = edges[0]; uv = UV[[v[1], w[1]]]; mm = np.linalg.norm(P[a] - P[b]); pixels = np.linalg.norm(uv[0] - uv[1])
        if mm < .009 or pixels < .1: continue
        width = np.clip(.053 * pixels / mm, 1.8, 11)
        segments.append((tuple(uv.flatten()), width))
    for radius, tone in [(1., 208), (.75, 145), (.52, 87), (.32, 47), (.16, 26)]:
        for xy, width in segments: draw.line(xy, fill=tone, width=max(1, round(width * radius * 2)))
    v = np.asarray(mask.filter(ImageFilter.GaussianBlur(.42))).astype(float) / 255
    # Leave the original wispy alpha at the ends. Vary coverage along the painted strands only where the scalp cap
    # itself had an opaque boundary.
    alpha = np.array(img.getchannel('A')) / 255
    fibre = np.asarray(img.convert('L'), float) - np.asarray(img.convert('L').filter(ImageFilter.GaussianBlur(1.25)), float)
    v = np.clip(v + (1 - v) * np.clip(fibre / 83, -.32, .55), 0, 1)
    v = 1 - (1 - v) * np.clip((alpha - .35) / .55, 0, 1)
    # Strip-card meshes (the messy cut) have long open side edges inside the front/top box the heuristic looks at; those
    # are not a hairline. When more than EDGE_MAX of the tile would be touched, the effect is scaled back to that share
    # (a soft edge instead of gaps). None of the first eight is above it, so they are unchanged.
    touched = float((v < .98).mean())
    if touched > EDGE_MAX: v = 1 - (1 - v) * (EDGE_MAX / touched)
    return Image.fromarray(np.uint8(np.clip(v, 0, 1) * 255)), len(segments)

def pad(tile): return Image.fromarray(np.pad(np.asarray(tile), ((4, 4), (4, 4)) + ((0, 0),) * (np.asarray(tile).ndim - 2), mode='edge'))

def bake_atlas(items, gains=None):
    """items: [(cut, diffuse name or None)] -> (normal, direction, edge atlases, per-cut report)"""
    normal = Image.new('RGB', (2048, 1024), (128, 128, 255)); direction = Image.new('RGB', (2048, 1024), (255, 128, 0)); edge = Image.new('L', (2048, 1024), 255)
    report = {}
    for i, (cut, name) in enumerate(items):
        folder = SRC / cut; img = diffuse(folder, name)
        gain = (gains or {}).get(cut, 1.0)
        n, d, slope = strand_tiles(img, gain)
        e, segs = hairline_tile(folder, cut, img)
        for dest, tile in [(normal, n), (direction, d), (edge, e)]: dest.paste(pad(tile), (i % 4 * 512, i // 4 * 512))
        report[cut] = {'slope': slope, 'gain': gain, 'segments': segs}
    return normal, direction, edge, report

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--verify', action='store_true'); ap.add_argument('--stats', action='store_true'); ap.add_argument('--out', default=str(OUT))
    args = ap.parse_args(); out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    first = [(c, None) for c in FIRST]
    _, _, _, base = bake_atlas(first)
    target = float(np.median([r['slope'] for r in base.values()]))
    if args.verify:
        normal, direction, edge, _ = bake_atlas(first)
        for name, atlas in [('hair-fibres', normal), ('hair-flow', direction), ('hairline', edge)]:
            have = Image.open(OUT / (name + '.webp')).convert(atlas.mode)
            if name == 'hair-flow': have = Image.open(OUT / 'hair-flow.webp').convert('RGB')
            diff = np.abs(np.asarray(have, dtype=int) - np.asarray(atlas, dtype=int)); print(name, 'max |diff| vs the shipped atlas:', int(diff.max()), 'mean', round(float(diff.mean()), 4))
        return
    # gain per cut: the first eight's median normal slope over this cut's, kept within a sane band
    gains = {}; stats = {}
    for cut, name in MORE:
        slope = strand_tiles(diffuse(SRC / cut, name), 1.0)[2]; g = float(np.clip(target / max(slope, 1e-4), .75, 2.0))
        gains[cut] = round(g, 3); stats[cut] = (round(slope, 4), gains[cut])
    if args.stats:
        print('first eight slope (median):', round(target, 4), {c: round(r['slope'], 4) for c, r in base.items()}); print('new cuts: raw slope, gain', stats); return
    manifest = {}
    for k in range(0, len(MORE), PER_ATLAS):
        group = MORE[k:k + PER_ATLAS]; suffix = '-' + str(k // PER_ATLAS + 2)
        normal, direction, edge, report = bake_atlas(group, gains)
        # Page weight: the new normal atlases are stored at steps of 2 (an 8-bit normal component is 1/127.5 of a unit, so
        # the error is at most .008) which the lossless coder packs about a quarter smaller; the first atlas stays as baked.
        normal = Image.fromarray((np.round(np.asarray(normal) / 2) * 2).clip(0, 255).astype(np.uint8))
        normal.save(out / ('hair-fibres' + suffix + '.webp'), lossless=True, method=6)
        direction.save(out / ('hair-flow' + suffix + '.webp'), quality=92, method=6)
        edge.save(out / ('hairline' + suffix + '.webp'), lossless=True, method=6)
        for i, (cut, _) in enumerate(group): manifest[cut] = {'atlas': k // PER_ATLAS + 2, 'tile': i, **report[cut]}
        print('atlas', suffix, [c for c, _ in group])
    lines = ['// Which tile of which hair atlas each hairstyle (people GLB material \'Human.<cut>\') is on: [atlas, tile].',
             '// Written by tools/people/bake-hair-maps.py. Atlas 0 is hair-fibres/-flow/hairline.webp (the original eight, in the',
             '// order media-cast-finishes.mjs always used), atlas k is hair-fibres-<k+1>.webp and so on; 2048 x 1024, eight 512 px',
             '// tiles with a 4 px guard band, tile i at column i % 4, row i >> 2.',
             'export const HAIR_ATLASES = [' + ', '.join(repr('' if k == 0 else '-' + str(k + 1)) for k in range(1 + (len(MORE) + PER_ATLAS - 1) // PER_ATLAS)) + '];',
             'export const HAIR_TILES = {']
    for i, c in enumerate(FIRST): lines.append("    %s: [0, %d]," % (c, i))
    for c, _ in MORE: lines.append("    %s: [%d, %d]," % (c, manifest[c]['atlas'] - 1, manifest[c]['tile']))
    lines.append('};')
    (ROOT / 'media-cast-hair-atlas.mjs').write_text('\n'.join(lines) + '\n')
    print(json.dumps({c: {'atlas': m['atlas'], 'tile': m['tile'], 'gain': m['gain'], 'slope': round(m['slope'], 4), 'edge segments': m['segments']} for c, m in manifest.items()}, indent=1))
if __name__ == '__main__': main()
