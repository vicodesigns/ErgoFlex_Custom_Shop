# usage: python luma.py <video> <out.csv> [fps=10] [offset s=0]
# Per-frame picture measurements of a hero render (the joined sub-shots), for the lighting-vs-beats plot:
#   luma      mean Rec.709 luma (0-1, of the display-referred frame)
#   p05/p50/p95/p99  luma percentiles (shadows, mid, highlights, peak), clip = share of pixels with luma > 0.98 (blown)
#   r,g,b     mean colour; keyHue/keySat: hue (deg) and saturation of the mean colour of the brightest 10 % of pixels that
#             are saturated (s > 0.25): the accent / key colour (red gaming LEDs read ~0-10 deg, warm white ~30-40 deg)
#   redShare  share of pixels that are clearly red (h < 20 or > 340 deg, s > 0.45, v > 0.25): the gaming LED glow
import sys, csv, subprocess
import numpy as np
v, out = sys.argv[1], sys.argv[2]
fps = float(sys.argv[3]) if len(sys.argv) > 3 else 10.0
off = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0
W, H = 320, 180
p = subprocess.run(['ffmpeg', '-v', 'error', '-i', v, '-vf', f'fps={fps},scale={W}:{H}:flags=area', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                   capture_output=True, check=True)
fr = np.frombuffer(p.stdout, np.uint8).reshape(-1, H, W, 3).astype(np.float32) / 255.0
rows = []
for i, f in enumerate(fr):
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    mx, mn = f.max(-1), f.min(-1); s = np.where(mx > 1e-4, (mx - mn) / np.maximum(mx, 1e-4), 0)
    # hue
    d = np.maximum(mx - mn, 1e-6)
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    sat = s > 0.25
    if sat.sum() > 20:
        thr = np.quantile(y[sat], 0.9); sel = sat & (y >= thr)
        c = f[sel].mean(0); cmx, cmn = c.max(), c.min(); dd = max(cmx - cmn, 1e-6)
        ch = (((c[1] - c[2]) / dd) % 6 if cmx == c[0] else ((c[2] - c[0]) / dd + 2 if cmx == c[1] else (c[0] - c[1]) / dd + 4)) * 60
        cs = (cmx - cmn) / max(cmx, 1e-6)
    else:
        ch, cs = float('nan'), 0.0
    red = ((h < 20) | (h > 340)) & (s > 0.45) & (mx > 0.25)
    q = np.quantile(y, [0.05, 0.5, 0.95, 0.99])
    rows.append([round(i / fps + off, 3), y.mean(), *q, (y > 0.98).mean(), r.mean(), g.mean(), b.mean(), ch, cs, red.mean()])
with open(out, 'w', newline='') as fo:
    w = csv.writer(fo); w.writerow(['s', 'luma', 'p05', 'p50', 'p95', 'p99', 'clip', 'r', 'g', 'b', 'keyHue', 'keySat', 'redShare'])
    for rr in rows: w.writerow([rr[0]] + [f'{x:.4f}' for x in rr[1:]])
print(out, len(rows), 'frames')
