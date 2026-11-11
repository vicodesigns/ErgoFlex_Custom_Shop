#!/usr/bin/env python3
"""Window vistas: rectilinear crops of CC0 Poly Haven panoramas (tonemapped JPG, 8192x4096).

    python3 tools/rooms/build-window-vistas.py <dir with the downloaded panoramas> [name ...]

Each crop looks at the horizon (pitch 0) with a 110 degree horizontal field of view, so
window-vista.mjs can map a view ray straight to a pixel. Source:
https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/<id>.jpg
"""
import math, os, sys
import numpy as np, cv2

HFOV, W, H = 110.0, 2048, 1280
#        name            panorama id                  heading (fraction of the panorama width)
VISTAS = {
    'garden':        ('suburban_garden',           0.55),
    'studio-garden': ('studio_garden',             0.42),
    'campus':        ('museumplein',               0.16),
    'city-day':      ('homecoming_center_rooftop', 0.66),
    'city-neon':     ('shanghai_bund',             0.58),
    'city-dusk':     ('sunset_jhbcentral',         0.48),
    'yard':          ('factory_yard',              0.62),
    'coast':         ('illovo_beach_balcony',      0.78),
}
# Vistas whose foreground is replaced by water reflecting the far shore (the photograph's own
# foreground is a crowded promenade at arm's length; the room looks out from across the river).
WATER = {'city-neon'}

def crop(pano, heading):
    ph, pw = pano.shape[:2]
    tx = math.tan(math.radians(HFOV) / 2); ty = tx * H / W
    X, Y = np.meshgrid(np.linspace(-tx, tx, W, dtype=np.float32), np.linspace(ty, -ty, H, dtype=np.float32))
    lon = np.arctan2(X, 1.0) + (heading * 2 * math.pi - math.pi)
    lat = np.arctan2(Y, np.sqrt(X * X + 1.0))
    u = ((lon / (2 * math.pi) + .5) % 1.0) * pw; v = (.5 - lat / math.pi) * ph
    return cv2.remap(pano, u.astype(np.float32), v.astype(np.float32), cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_WRAP)

def water(img):
    h, w = img.shape[:2]; line = int(h * .488)                       # just above the horizon: the far shore's waterline
    below = h - line; src = cv2.flip(img[max(0, line - below):line], 0).astype(np.float32)
    if src.shape[0] < below: src = cv2.copyMakeBorder(src, 0, below - src.shape[0], 0, 0, cv2.BORDER_REPLICATE)
    # Reflections stretch down the water and break up with distance from the shore.
    src = cv2.resize(src[: int(below * .55)], (w, below), interpolation=cv2.INTER_LINEAR)
    src = cv2.GaussianBlur(cv2.blur(src, (3, 61)), (0, 0), 3)
    rng = np.random.default_rng(7); ripple = cv2.GaussianBlur(rng.random((below, w)).astype(np.float32), (0, 0), sigmaX=22, sigmaY=1.6)
    ripple = (ripple - ripple.mean()) / (ripple.std() + 1e-6)
    fall = np.linspace(.62, .2, below, dtype=np.float32)[:, None]
    lum = (src * (fall * (1 + .22 * ripple))[..., None]) + np.array([34, 16, 12], np.float32) * (1 - fall)[..., None] * .55
    out = img.copy(); out[line:] = np.clip(lum, 0, 255).astype(np.uint8)
    out[line - 3:line + 3] = cv2.GaussianBlur(out[line - 3:line + 3], (0, 0), 1.2)
    return out

def main():
    src = sys.argv[1]; names = sys.argv[2:] or list(VISTAS)
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'rooms', 'vistas')
    os.makedirs(out, exist_ok=True)
    for name in names:
        pano_id, heading = VISTAS[name]
        pano = cv2.imread(os.path.join(src, pano_id + '.jpg'), cv2.IMREAD_COLOR)
        if pano is None: raise SystemExit(f'missing panorama {pano_id}.jpg in {src}')
        path = os.path.join(out, name + '.jpg')
        img = crop(pano, heading)
        if name in WATER: img = water(img)
        cv2.imwrite(path, img, [cv2.IMWRITE_JPEG_QUALITY, 84])
        print(name, pano_id, heading, os.path.getsize(path))

if __name__ == '__main__': main()
