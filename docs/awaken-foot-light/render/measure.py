import sys, json, os, colorsys
sys.path.insert(0, 'C:/work/fixB/pylib')
import numpy as np
from PIL import Image
# measure.py <before dir> <after dir> <out csv/json prefix>: per frame the foot pool's luma / saturation before and after, and whole-frame diffs
bd, ad, out = sys.argv[1:4]
SECS = 44.85
def frames(d):
    fs = {}
    for f in os.listdir(d):
        if f.endswith('.png') and '-still-1920x1080-t' in f: fs[round(float(f.split('-t')[1][:-4]) * SECS, 2)] = f
    return fs
fb, fa = frames(bd), frames(ad)
W, H = 1920, 1080
def L(p): return np.asarray(Image.open(p).convert('RGB')).astype(np.float64)
rows = []
for t in sorted(fb):
    if t not in fa: continue
    b, a = L(os.path.join(bd, fb[t])), L(os.path.join(ad, fa[t]))
    pr = json.load(open(os.path.join(ad, fa[t].replace('-still-1920x1080-t', '-probe-t').replace('.png', '.json'))))
    c = pr['screen'][0]
    xs = [c[0] + 2.33 * (p[0] - c[0]) for p in pr['screen'][1:]] + [c[0]]
    ys = [c[1] + 2.33 * (p[1] - c[1]) for p in pr['screen'][1:]] + [c[1]]
    x0, x1 = int(max(0, min(xs) * W)), int(min(W, max(xs) * W)); y0, y1 = int(max(0, min(ys) * H)), int(min(H, max(ys) * H))
    d = np.abs(a - b)
    r = dict(t=t, frame_mean_abs_diff=round(d.mean(), 3), frame_frac_gt2=round(float((d.max(axis=2) > 2).mean()), 5), frame_max=int(d.max()))
    if x1 - x0 > 8 and y1 - y0 > 8:
        for name, im in (('before', b), ('after', a)):
            reg = im[y0:y1, x0:x1].reshape(-1, 3) / 255.0
            lum = reg @ np.array([.2126, .7152, .0722]); mx, mn = reg.max(axis=1), reg.min(axis=1)
            sat = np.where(mx > 0.02, (mx - mn) / np.maximum(mx, 1e-6), 0)
            top = lum >= np.percentile(lum, 90)   # the brightest decile of the box = the pool's core (the box also holds desk and floor)
            r[name + '_luma_mean'] = round(float(lum.mean()), 4); r[name + '_luma_p90'] = round(float(np.percentile(lum, 90)), 4)
            r[name + '_sat_top'] = round(float(sat[top].mean()), 4); r[name + '_chroma_top'] = round(float((mx - mn)[top].mean()), 4)
        r['box'] = [x0, y0, x1, y1]
    rows.append(r)
json.dump(rows, open(out + '.json', 'w'), indent=1)
keys = ['t', 'before_luma_mean', 'after_luma_mean', 'before_luma_p90', 'after_luma_p90', 'before_sat_top', 'after_sat_top', 'before_chroma_top', 'after_chroma_top', 'frame_mean_abs_diff', 'frame_frac_gt2', 'frame_max']
with open(out + '.csv', 'w') as f:
    f.write(','.join(keys) + '\n')
    for r in rows: f.write(','.join(str(r.get(k, '')) for k in keys) + '\n')
for r in rows: print(' '.join(f'{k}={r.get(k, "")}' for k in keys))
