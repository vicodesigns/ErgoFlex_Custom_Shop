# Chapter 12 hero desk props (polish1124 Stream D): the textures the Blender build uses, generated deterministically.
#   python tools/props/hero-desks/textures.py <out dir>
# Colour images: the framed photo, the small lakeside-dusk canvas, the architect scale's printed faces, binder spine labels.
# Normal maps (tileable, from height fields): wood grain (from assets/wood), leather grain, canvas weave, paper fibre,
# the mic's grille mesh, knurling. Nothing here is written into the repo; the GLBs embed them (webp, 512 px max).
import os, sys, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
OUT = sys.argv[1] if len(sys.argv) > 1 else 'hero-desk-textures'
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(1124)
def font(size, bold=False):
    for f in (os.path.join(ROOT, 'app-reference/assets/google_fonts/Poppins-%s.ttf' % ('SemiBold' if bold else 'Medium')),
              'C:/Windows/Fonts/%s.ttf' % ('arialbd' if bold else 'arial'), '/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf' % ('-Bold' if bold else '')):
        if os.path.exists(f): return ImageFont.truetype(f, size)
    return ImageFont.load_default()
def save(im, name): im.save(os.path.join(OUT, name), quality=92)
def normal_from_height(h, strength=2.0):
    h = h.astype(np.float32)
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    n = np.dstack([-dx, dy, np.ones_like(h)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
    return Image.fromarray(((n * .5 + .5) * 255).astype(np.uint8), 'RGB')
def tile_noise(size, scale, seed):
    r = np.random.default_rng(seed); small = r.random((scale, scale))
    im = Image.fromarray((small * 255).astype(np.uint8)).resize((size, size), Image.BICUBIC)
    return np.asarray(im, np.float32) / 255
# ---------------------------------------------------------------- wood (colour + normal) from the repo's wood scans
for src, name in (('maple', 'beech'), ('walnut', 'walnut')):
    im = Image.open(os.path.join(ROOT, 'assets/wood', src + '.jpg')).convert('RGB').resize((512, 512), Image.LANCZOS)
    save(im, 'wood-%s.jpg' % name)
    g = np.asarray(im.convert('L').filter(ImageFilter.GaussianBlur(1.2)), np.float32) / 255
    save(normal_from_height(g, 3.0), 'wood-%s-normal.png' % name)
# ---------------------------------------------------------------- leather grain, canvas weave, paper fibre, knurl, grille
h = sum(tile_noise(256, s, i) * w for i, (s, w) in enumerate(((64, .5), (128, .35), (32, .15))))
h = np.abs(h - .5) * 2; save(normal_from_height(h, 2.4), 'leather-normal.png')
y, x = np.mgrid[0:256, 0:256]
weave = (np.sin(x / 256 * math.pi * 2 * 48) * (np.sin(y / 256 * math.pi * 2 * 24) > 0) + np.sin(y / 256 * math.pi * 2 * 48) * (np.sin(x / 256 * math.pi * 2 * 24) <= 0)) * .5 + .5
save(normal_from_height(weave + tile_noise(256, 64, 9) * .3, 1.4), 'canvas-normal.png')
save(normal_from_height(tile_noise(256, 128, 3) * .6 + tile_noise(256, 32, 4) * .4, 1.0), 'paper-normal.png')
save(normal_from_height((np.sin((x + y) / 256 * math.pi * 2 * 32) * np.sin((x - y) / 256 * math.pi * 2 * 32)) * .5 + .5, 1.6), 'knurl-normal.png')
gr = np.zeros((256, 256), np.float32)
for j in range(0, 256, 16):
    for i in range(0, 256, 16):
        ox = 8 if (j // 16) % 2 else 0; gr += np.exp(-(((x - (i + ox) % 256 + 128) % 256 - 128) ** 2 + ((y - j + 128) % 256 - 128) ** 2) / 18.0)
save(normal_from_height(1 - np.clip(gr, 0, 1), 3.0), 'grille-normal.png')
# ---------------------------------------------------------------- the framed photo: a family at the beach, golden hour
W, H = 512, 768
yy = np.linspace(0, 1, H)[:, None]
sky = np.dstack([np.interp(yy, [0, .45, .62], [.33, .98, 1.0]), np.interp(yy, [0, .45, .62], [.52, .74, .86]), np.interp(yy, [0, .45, .62], [.78, .58, .62])]) * np.ones((1, W, 1))
img = (sky * 255).astype(np.uint8); photo = Image.fromarray(img, 'RGB'); d = ImageDraw.Draw(photo, 'RGBA')
hz = int(H * .58)
d.ellipse((300, hz - 80, 400, hz + 20), fill=(255, 236, 190, 255))                      # low sun
for k in range(6): d.ellipse((300 - k * 30, hz - 80 - k * 30, 400 + k * 30, hz + 20 + k * 30), fill=(255, 220, 160, 22))
d.rectangle((0, hz, W, int(H * .74)), fill=(54, 104, 150, 255))                           # sea
for k in range(160):
    sx = 350 + rng.normal(0, 60); sy = rng.uniform(hz + 4, H * .74)
    d.line((sx - rng.uniform(4, 16), sy, sx + rng.uniform(4, 16), sy), fill=(255, 220, 170, int(rng.uniform(60, 190))), width=2)
d.rectangle((0, int(H * .74), W, H), fill=(214, 186, 140, 255))                           # sand
d.polygon([(0, int(H * .74)), (W, int(H * .72)), (W, int(H * .77)), (0, int(H * .79))], fill=(236, 230, 214, 200))   # surf line
def person(cx, foot, hgt, col=(38, 30, 40, 255), stride=0.0):
    # a walking figure from round strokes: head, torso, arms, legs (silhouette against the low sun)
    w = max(3, int(hgt * .075)); hip = (cx, foot - hgt * .47); neck = (cx, foot - hgt * .82)
    d.ellipse((cx - hgt * .065, foot - hgt * .97, cx + hgt * .065, foot - hgt * .84), fill=col)
    d.line((neck, hip), fill=col, width=int(w * 1.9)); d.ellipse((hip[0] - w, hip[1] - w, hip[0] + w, hip[1] + w), fill=col)
    for sgn in (-1, 1):
        kx = cx + sgn * hgt * (.06 + stride * .5); d.line((hip, (kx, foot - hgt * .23), (cx + sgn * hgt * (.05 + stride), foot)), fill=col, width=w, joint='curve')
        d.line(((cx, neck[1] + w), (cx + sgn * hgt * .12, foot - hgt * .6), (cx + sgn * hgt * .15, foot - hgt * .44)), fill=col, width=int(w * .8), joint='curve')
    d.ellipse((neck[0] - w, neck[1] - w * .5, neck[0] + w, neck[1] + w * 1.5), fill=col)
foot = int(H * .83)
for cx, hgt, st in ((160, 150, .05), (205, 136, -.04), (184, 84, .07)):
    person(cx, foot + (0 if hgt > 150 else 4), hgt, stride=st)
    d.polygon([(cx - 14, foot + 6), (cx + 14, foot + 6), (cx + 70, foot + 40), (cx + 20, foot + 40)], fill=(150, 120, 90, 90))   # long shadows
d.line((170, foot - 78, 184, foot - 48), fill=(38, 30, 40, 255), width=5); d.line((198, foot - 72, 188, foot - 48), fill=(38, 30, 40, 255), width=5)   # holding hands
photo = photo.filter(ImageFilter.GaussianBlur(1.1))
a = np.asarray(photo, np.float32); vig = 1 - .35 * ((np.linspace(-1, 1, W)[None, :]) ** 2 + (np.linspace(-1, 1, H)[:, None]) ** 2)
a = a * vig[..., None] + rng.normal(0, 4, a.shape); photo = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
save(photo, 'photo-beach.jpg')
# ---------------------------------------------------------------- the small canvas: Lin's lakeside dusk, as an oil study
W, H = 512, 640
pal = {'sky0': (58, 63, 134), 'sky1': (231, 160, 122), 'sun': (255, 228, 176), 'hill': (107, 76, 154), 'hill2': (62, 148, 136), 'water0': (42, 95, 147), 'water1': (31, 61, 110), 'tree': (24, 52, 58)}
base = Image.new('RGB', (W, H)); d = ImageDraw.Draw(base, 'RGBA')
for j in range(H):
    v = j / H
    c = [int(np.interp(v, [0, .38, .55], [pal['sky0'][k], pal['sky1'][k], pal['sky1'][k]])) for k in range(3)] if v < .55 else \
        [int(np.interp(v, [.55, 1], [pal['water0'][k], pal['water1'][k]])) for k in range(3)]
    d.line((0, j, W, j), fill=tuple(c))
d.ellipse((330, 170, 400, 240), fill=pal['sun'])
ridge = lambda x, a, f, p: a * math.sin(x * f + p) + a * .5 * math.sin(x * f * 2.3 + p * 1.7)
d.polygon([(0, H)] + [(x, H * .42 + ridge(x / W * 6, 18, 1, 0)) for x in range(0, W + 8, 8)] + [(W, H)], fill=pal['hill'])
d.polygon([(0, H)] + [(x, H * .5 + ridge(x / W * 6, 12, 1.6, 2)) for x in range(0, W + 8, 8)] + [(W, H)], fill=pal['hill2'])
for j in range(int(H * .55), H): d.line((0, j, W, j), fill=tuple(int(np.interp(j / H, [.55, 1], [pal['water0'][k], pal['water1'][k]])) for k in range(3)))
for tx in (40, 70, 95, 120):
    th = rng.uniform(70, 120); d.polygon([(tx, H * .56 - th), (tx - 16, H * .56), (tx + 16, H * .56)], fill=pal['tree'])
for k in range(90):   # sun path on the water
    sx = 365 + rng.normal(0, 26); sy = rng.uniform(H * .57, H * .9); d.line((sx - 10, sy, sx + 10, sy), fill=(255, 214, 160, int(rng.uniform(80, 200))), width=3)
arr = np.asarray(base).copy()
paint = Image.fromarray(arr); d = ImageDraw.Draw(paint, 'RGBA')
for k in range(5200):   # impasto: short strokes in the local colour, slightly jittered
    x0, y0 = rng.uniform(0, W), rng.uniform(0, H); c = arr[int(y0) % H, int(x0) % W].astype(int) + rng.integers(-16, 17, 3)
    ang = rng.normal(0, .35) + (0 if y0 < H * .55 else 0); ln = rng.uniform(6, 18)
    d.line((x0, y0, x0 + ln * math.cos(ang), y0 + ln * math.sin(ang)), fill=(*np.clip(c, 0, 255).tolist(), 200), width=int(rng.uniform(3, 7)))
paint = paint.filter(ImageFilter.SMOOTH)
save(paint, 'painting-lakeside-dusk.jpg')
pn = np.asarray(paint.convert('L'), np.float32) / 255; save(normal_from_height(pn * .6 + weave[:1, :1].mean() * 0 + np.asarray(Image.fromarray((weave * 255).astype(np.uint8)).resize((W, H)), np.float32) / 255 * .25, 2.2), 'painting-normal.png')
# ---------------------------------------------------------------- the triangular architect scale: three printed faces (1:50/1:100, 1:20/1:200, 1:250/1:500)
W, H = 1024, 192
scale = Image.new('RGB', (W, H), (236, 238, 240)); d = ImageDraw.Draw(scale); f = font(15)
for face, (lab, col) in enumerate((('1:100', (30, 30, 30)), ('1:200', (176, 40, 34)), ('1:500', (24, 60, 140)))):
    y0 = face * 64
    d.line((0, y0, W, y0), fill=(190, 194, 198), width=2)
    for i in range(0, 300):
        x = 12 + i * (W - 24) / 300; L = 22 if i % 10 == 0 else 14 if i % 5 == 0 else 8
        d.line((x, y0 + 2, x, y0 + 2 + L), fill=col, width=1)
        if i % 20 == 0: d.text((x + 2, y0 + 26), str(i // 10), font=f, fill=col)
    d.text((W - 70, y0 + 40), lab, font=font(16, True), fill=col)
save(scale, 'scale-ruler.png')
# ---------------------------------------------------------------- binder spine labels
for name, title, sub in (('binder-a', 'CONTRACTS', '2026 · A-L'), ('binder-b', 'Q3 REPORTS', 'Finance'), ('binder-c', 'TAX', '2025')):
    im = Image.new('RGB', (128, 256), (246, 244, 236)); d = ImageDraw.Draw(im)
    d.rectangle((6, 6, 121, 249), outline=(60, 60, 60), width=2)
    tf = font(22, True); tw = d.textlength(title, font=tf)
    lab = Image.new('RGBA', (240, 60), (0, 0, 0, 0)); ld = ImageDraw.Draw(lab); ld.text(((240 - tw) / 2, 4), title, font=tf, fill=(30, 30, 34)); ld.text((70, 32), sub, font=font(16), fill=(90, 90, 96))
    im.paste(lab.rotate(90, expand=True), (34, 8), lab.rotate(90, expand=True))
    save(im, name + '.png')
print('textures ->', OUT)
