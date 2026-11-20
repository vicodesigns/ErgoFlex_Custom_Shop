#!/usr/bin/env python3
"""Commons pilot sign and carpet textures (library-humboldt-commons.mjs), drawn once, offline, at a crisp size.

    python3 tools/rooms/build-commons-textiles.py [outdir]     (default assets/rooms/library, previews go to docs/)

  commons-pilot-sign.webp        2048x568  colour of the green 'FLEXIBLE STUDY' wall board (1800 x 500 mm, true aspect)
  commons-pilot-sign-bump.webp   1024x284  height of the same: raised printing and a pressed frame
  commons-pilot-carpet.webp      2048x1728 colour of the green pilot bay (3200 x 2700 mm): pile variation, tuft rows, a bound edge
  commons-pilot-legend.webp      2048x320  the white 'ERGOFLEX / PILOT CONCEPT' inlay (1600 x 250 mm), alpha, tufted fibre inside the letters
  commons-fibre-normal.webp      256x256   tileable tufted-loop fibre normal map, shared by the bay and the legend (one tile = 60 mm)

Colours are the ones the room always had (#123f33 sign, #154c3d carpet, #e1d3a6 lettering, #d3b96f brass); only the detail is new.
Needs numpy and Pillow; fonts are Windows' Arial / Arial Bold.
"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'assets', 'rooms', 'library')
DOCS = os.path.join(ROOT, 'docs')
FONTS = 'C:/Windows/Fonts/'
rng = np.random.default_rng(20261119)


def hexrgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32)


def font(name, px):
    return ImageFont.truetype(FONTS + name, int(round(px)))


def blur(a, sigma):
    """Wrap-around gaussian blur by FFT (tileable)."""
    h, w = a.shape
    fy = np.fft.fftfreq(h)[:, None]; fx = np.fft.fftfreq(w)[None, :]
    k = np.exp(-2 * (np.pi * sigma) ** 2 * (fx * fx + fy * fy))
    return np.real(np.fft.ifft2(np.fft.fft2(a) * k))


def noise(h, w, sigma, seed=None):
    g = np.random.default_rng(seed) if seed is not None else rng
    n = blur(g.standard_normal((h, w)).astype(np.float32), sigma)
    return n / (n.std() + 1e-9)


def tracked(draw, xy, text, fnt, fill, tracking):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill, anchor='ls')
        x += draw.textlength(ch, font=fnt) + tracking
    return x


def save(img, name, **kw):
    p = os.path.join(OUT, name)
    img.save(p, 'WEBP', **kw)
    print(name, img.size, os.path.getsize(p), 'bytes')


# ---------------------------------------------------------------- fibre normal (tileable)
def fibre_height(n=256):
    """Tufted loop pile: rows of rounded loops, each loop a little taller or shorter, plus loose fibre."""
    y, x = np.mgrid[0:n, 0:n].astype(np.float32)
    rows = 16; period = n / rows                     # 16 rows and 16 loops per row over one tile
    row = np.floor(y / period); v = (y % period) / period - .5
    shift = (row * 0.37 % 1.0) * period              # each row offset, so loops stagger
    u = ((x + shift) % period) / period - .5
    loop = np.clip(1 - (u * u * 4 + v * v * 3.2), 0, 1) ** .7
    ids = (np.floor((x + shift) / period) % rows).astype(int)
    jit = rng.random((rows, rows)).astype(np.float32)
    jit_full = jit[row.astype(int) % rows, ids]
    h = loop * (.65 + .35 * jit_full)
    h = h + .22 * noise(n, n, 1.1) * .25 + .10 * noise(n, n, .6) * .2
    return h


def fibre_normal(n=256, strength=1.4):
    h = fibre_height(n)
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * .5 * strength * 6
    gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * .5 * strength * 6
    nz = np.ones_like(h)
    L = np.sqrt(gx * gx + gy * gy + nz * nz)
    out = np.stack([(-gx / L) * .5 + .5, (gy / L) * .5 + .5, (nz / L) * .5 + .5], -1)   # +Y up, three.js convention
    return Image.fromarray((out * 255 + .5).astype(np.uint8)), h


# ---------------------------------------------------------------- sign
def build_sign():
    W, H = 2048, 568                                 # 1800 x 500 mm at 1.138 px/mm
    px = W / 1800
    base = hexrgb('#123f33'); brass = hexrgb('#d3b96f'); cream = hexrgb('#ece8d8')
    # matte printed board: faint vertical brush, fine grain, a soft light fall-off from the top
    g = noise(H, W, 1.0) * .018 + noise(H, W, 40) * .010
    col = noise(1, W, 1.6)[0]                                          # faint vertical brush
    g = g + col[None, :] * .008
    fall = (np.linspace(1.0, .94, H)[:, None]) + 0 * g
    rgb = base[None, None, :] * (1 + g[..., None]) * fall[..., None]
    img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).convert('RGB')
    d = ImageDraw.Draw(img)
    # frame: a thin brass line inset 22 mm with a second hairline 8 mm inside, and the left brass bar of the old sign
    m = int(22 * px); d.rectangle([m, m, W - m - 1, H - m - 1], outline=tuple(int(v) for v in brass), width=max(2, int(2.6 * px)))
    m2 = int(34 * px); d.rectangle([m2, m2, W - m2 - 1, H - m2 - 1], outline=tuple(int(v * .62 + base[i] * .38) for i, v in enumerate(brass)), width=1)
    d.rectangle([int(62 * px), int(62 * px), int(62 * px) + int(7 * px), H - int(62 * px)], fill=tuple(int(v) for v in brass))
    x0 = 118 * px
    # the three text lines on the old sign's baselines (156 / 249 / 356 mm of the 500 mm board)
    tracked(d, (x0, 160 * px), 'FLEXIBLE STUDY', font('arialbd.ttf', 128 * px), tuple(int(v) for v in cream), 3 * px)
    d.text((x0, 258 * px), 'ErgoFlex \u00b7 proposed pilot', font=font('arial.ttf', 72 * px), fill=tuple(int(v) for v in cream), anchor='ls')
    d.line([x0, 306 * px, x0 + 560 * px, 306 * px], fill=tuple(int(v) for v in brass), width=max(1, int(1.6 * px)))
    tracked(d, (x0, 372 * px), 'HUMBOLDT-INSPIRED COMMONS', font('arialbd.ttf', 50 * px), tuple(int(v) for v in brass), 6 * px)
    # height map: pressed frame (low), raised ink
    hm = Image.new('L', (W, H), 128); hd = ImageDraw.Draw(hm)
    m = int(22 * px); hd.rectangle([m, m, W - m - 1, H - m - 1], outline=90, width=max(2, int(2.6 * px)))
    hd.rectangle([int(62 * px), int(62 * px), int(62 * px) + int(7 * px), H - int(62 * px)], fill=170)
    tracked(hd, (x0, 160 * px), 'FLEXIBLE STUDY', font('arialbd.ttf', 128 * px), 175, 3 * px)
    hd.text((x0, 258 * px), 'ErgoFlex \u00b7 proposed pilot', font=font('arial.ttf', 72 * px), fill=175, anchor='ls')
    tracked(hd, (x0, 372 * px), 'HUMBOLDT-INSPIRED COMMONS', font('arialbd.ttf', 50 * px), 175, 6 * px)
    hn = np.asarray(hm, np.float32) + noise(H, W, .8) * 4
    hm = Image.fromarray(np.clip(hn, 0, 255).astype(np.uint8)).resize((W // 2, H // 2), Image.LANCZOS)
    return img, hm


# ---------------------------------------------------------------- carpet
def build_carpet():
    W, H = 2048, 1728                                # 3200 x 2700 mm at 0.64 px/mm
    px = W / 3200
    base = hexrgb('#154c3d')
    big = noise(H, W, 90, 11) * .035 + noise(H, W, 22, 12) * .022          # pile lie / dye variation
    fine = noise(H, W, .9) * .028                                          # tuft speckle
    rows = np.sin(np.arange(H, dtype=np.float32) * 2 * np.pi / (5.5 * px * 2.3))[:, None] * .012   # tuft rows (~14 mm)
    shade = 1 + big + fine + rows
    rgb = base[None, None, :] * shade[..., None]
    # lighter, slightly yellower pile tips scattered over the field
    tips = np.clip(noise(H, W, 1.3) - 1.6, 0, None) * .08
    rgb += tips[..., None] * np.array([40, 60, 30], np.float32)
    # bound edge: a 42 mm flat woven binding in a deeper green, with a running stitch 14 mm in
    bw = int(42 * px)
    yy, xx = np.mgrid[0:H, 0:W]
    edge = np.minimum.reduce([xx, W - 1 - xx, yy, H - 1 - yy]).astype(np.float32)
    inb = np.clip((bw + 1.2 - edge) / 2.4, 0, 1)                           # soft inner edge of the binding
    bind = hexrgb('#0f3a2e')[None, None, :] * (1 + noise(H, W, .6) * .012 + (xx % 6 < 3) * 0.0)[..., None]
    rgb = rgb * (1 - inb[..., None]) + bind * inb[..., None]
    # inner shadow where the pile meets the binding, and an outer rolled edge
    shadow = np.clip(1 - np.abs(edge - bw - 5 * px) / (7 * px), 0, 1) * (edge > bw)
    rgb *= (1 - .07 * shadow)[..., None]
    rgb *= (1 - .12 * np.clip(1 - edge / (4 * px), 0, 1))[..., None]
    img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).convert('RGB')
    d = ImageDraw.Draw(img)
    st = int(14 * px); lc = tuple(int(v * .62) + 10 for v in hexrgb('#4f8a73'))
    dash = int(9 * px); gap = int(7 * px)
    for x in range(st + dash, W - st - dash, dash + gap):
        d.line([x, st, x + dash, st], fill=lc, width=1); d.line([x, H - 1 - st, x + dash, H - 1 - st], fill=lc, width=1)
    for y in range(st + dash, H - st - dash, dash + gap):
        d.line([st, y, st, y + dash], fill=lc, width=1); d.line([W - 1 - st, y, W - 1 - st, y + dash], fill=lc, width=1)
    return img


# ---------------------------------------------------------------- legend inlay
def build_legend():
    W, H = 2048, 320                                 # 1600 x 250 mm at 1.28 px/mm, the bay's lettering plane
    cream = hexrgb('#e1d3a6')
    mask = Image.new('L', (W * 2, H * 2), 0); md = ImageDraw.Draw(mask)         # 2x supersample for clean edges
    f1 = font('arialbd.ttf', 92 * 2); f2 = font('arial.ttf', 48 * 2)
    def centred(text, y, fnt, tr):
        w = sum(md.textlength(c, font=fnt) + tr for c in text) - tr
        tracked(md, (W - w / 2, y), text, fnt, 255, tr)
    centred('ERGOFLEX  /  PILOT CONCEPT', 120 * 2 + 14, f1, 5)
    centred('SIT   \u00b7   STAND   \u00b7   TILT   \u00b7   RELOCATE', 190 * 2 + 4, f2, 8)
    md.rectangle([W - 480, 238 * 2, W + 480, 238 * 2 + 3], fill=255)
    a = np.asarray(mask.resize((W, H), Image.LANCZOS), np.float32) / 255
    # tufted inlay: the cream pile shows rows and speckle, and breaks up a little at the edge
    fibre = 1 + noise(H, W, .8) * .05 + np.sin(np.arange(H, dtype=np.float32) * 2 * np.pi / 7)[:, None] * .025
    a = np.clip(a * (.96 + noise(H, W, .7) * .06), 0, 1)
    # a faint darker pile rim hugging the letters (the inlay sits slightly proud of the field)
    rim = np.clip(blur(a, 2.2) * 1.0 - a, 0, 1) * .38
    rgb = cream[None, None, :] * fibre[..., None]
    rim_rgb = hexrgb('#0c2c22')[None, None, :]
    alpha = np.clip(a + rim, 0, 1)
    col = (rgb * a[..., None] + rim_rgb * rim[..., None]) / np.maximum(alpha[..., None], 1e-4)
    col = np.where(alpha[..., None] < .01, cream[None, None, :], col)
    out = np.dstack([np.clip(col, 0, 255), alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def preview(img, name, maxw=1200):
    os.makedirs(DOCS, exist_ok=True)
    im = img.convert('RGBA') if img.mode == 'RGBA' else img
    if im.mode == 'RGBA':
        bg = Image.new('RGBA', im.size, (21, 76, 61, 255)); bg.alpha_composite(im); im = bg.convert('RGB')
    s = min(1.0, maxw / im.width); im = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
    im.convert('P', palette=Image.ADAPTIVE, colors=128).save(os.path.join(DOCS, name), optimize=True)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    nrm, _ = fibre_normal()
    sign, bump = build_sign()
    carpet = build_carpet(); legend = build_legend()
    save(nrm, 'commons-fibre-normal.webp', lossless=True, method=6)
    save(sign, 'commons-pilot-sign.webp', quality=90, method=6)
    save(bump, 'commons-pilot-sign-bump.webp', quality=85)
    save(carpet, 'commons-pilot-carpet.webp', quality=88, method=6)
    save(legend, 'commons-pilot-legend.webp', quality=92, method=6)
    preview(sign, 'commons-pilot-sign-preview.png')
    # carpet preview: the field with the legend placed where the bay carries it, plus a fibre-normal crop
    comp = carpet.copy().convert('RGBA')
    lw = int(1600 / 3200 * comp.width); lg = legend.resize((lw, int(lw * legend.height / legend.width)), Image.LANCZOS)
    comp.alpha_composite(lg, ((comp.width - lw) // 2, comp.height // 2 - lg.height // 2))
    preview(comp.convert('RGB'), 'commons-pilot-carpet-preview.png', 800)
    crop = carpet.crop((0, 0, 512, 400)).resize((1024, 800), Image.NEAREST); preview(crop, 'commons-pilot-carpet-corner-preview.png', 800)
    preview(nrm.resize((384, 384), Image.NEAREST), 'commons-fibre-normal-preview.png', 384)
