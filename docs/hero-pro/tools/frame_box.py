# usage: python frame_box.py <video> <out.csv> [fps=10]
# Where the desk sits in the frame, per frame: the bounding box of the lit subject (pixels clearly brighter than the dark
# stage: luma > 0.16 or a saturated LED red/screen colour, after a 3x3 opening so the thin grid lines and the floor ring drop
# out), as fractions of the frame: top (headroom), bottom, left, right, centre x, and the subject's area share.
import sys, csv, subprocess
import numpy as np
v, out = sys.argv[1], sys.argv[2]
fps = float(sys.argv[3]) if len(sys.argv) > 3 else 10.0
W, H = 427, 240
p = subprocess.run(['ffmpeg', '-v', 'error', '-i', v, '-vf', f'fps={fps},scale={W}:{H}:flags=area', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True)
fr = np.frombuffer(p.stdout, np.uint8).reshape(-1, H, W, 3).astype(np.float32) / 255.0
def erode(m):
    o = m.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            o &= np.roll(np.roll(m, dy, 0), dx, 1)
    return o
def dilate(m):
    o = m.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            o |= np.roll(np.roll(m, dy, 0), dx, 1)
    return o
rows = []
for i, f in enumerate(fr):
    y = 0.2126 * f[..., 0] + 0.7152 * f[..., 1] + 0.0722 * f[..., 2]
    mx, mn = f.max(-1), f.min(-1); s = (mx - mn) / np.maximum(mx, 1e-4)
    cyan = (f[..., 2] > f[..., 0] * 1.6) & (f[..., 1] > f[..., 0] * 1.3) & (y < 0.45)     # the floor ring / grid
    m = ((y > 0.16) | ((s > 0.5) & (mx > 0.3))) & ~cyan
    m = dilate(erode(m))
    ys, xs = np.nonzero(m)
    if len(xs) < 30: rows.append([i / fps, '', '', '', '', '', 0]); continue
    # robust extent: 0.3 % tails dropped
    t, b = np.quantile(ys, [0.003, 0.997]); l, r = np.quantile(xs, [0.003, 0.997])
    rows.append([round(i / fps, 3), t / H, b / H, l / W, r / W, (l + r) / 2 / W, m.mean()])
with open(out, 'w', newline='') as fo:
    w = csv.writer(fo); w.writerow(['s', 'top', 'bottom', 'left', 'right', 'cx', 'area'])
    for rr in rows: w.writerow([rr[0]] + [f'{x:.4f}' if x != '' else '' for x in rr[1:]])
print(out, len(rows))
