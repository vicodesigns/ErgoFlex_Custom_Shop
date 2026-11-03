import json, sys, math, os, subprocess, bisect
from PIL import Image, ImageDraw, ImageFilter
cfg = json.load(open(sys.argv[1])); outmp4 = sys.argv[2]; W, H = int(sys.argv[3]), int(sys.argv[4])
stills_dir = sys.argv[5] if len(sys.argv) > 5 else None
D = cfg['out']; log = json.load(open(D + '/log.json'))
S = W / cfg['w']  # CSS px -> output px
FPS = 30; DUR = 17.0; NF = int(DUR * FPS)
ev = {e['ev']: e['i'] for e in log if e.get('ev')}
shots = [e['i'] for e in log if e.get('shot')]
R = {e['i']: e['r'] for e in log}
def shot_at(i):  # latest shot at or before i
    j = bisect.bisect_right(shots, i) - 1
    return shots[max(j, 0)]
ss = lambda u: (lambda f: f*f*(3-2*f))(max(0.0, min(1.0, u)))
d1, u1, d2, u2 = ev['down1'], ev['up1'], ev['down2'], ev['up2']
r0 = R[d1]
m1s = next(i for i in range(d1, d2) if R[i] != r0)
r1 = R[d2]  # settled readout after phase 1
m1e = next(i for i in range(m1s, d2) if R[i] == r1)
m2s = next(i for i in range(d2, len(log)) if R[i] != r1)
r2 = max(R[i] for i in range(m2s, u2 + 1))
m2e = next(i for i in range(m2s, u2 + 1) if R[i] == r2)
print('events', ev, 'm1s', m1s, 'm1e', m1e, 'm2s', m2s, 'm2e', m2e, 'r0 r1 r2', r0, r1, r2)
def first_reaching(lo, hi, target):
    for i in range(lo, hi + 1):
        if R[i] is not None and R[i] >= target - 1e-6: return i
    return hi
T_TAP1, T_UP1 = 1.0, 1.0 + (u1 - d1) / FPS
T_M1, T_M1E = 1.6, 6.4; T_TAP2, T_M2, T_M2E = 7.0, 7.4, 10.6
hit1 = None; plan = []
for k in range(NF):
    t = k / FPS
    if t < T_TAP1: i = d1 - round((T_TAP1 - t) * FPS)
    elif t < T_M1: i = d1 + int((t - T_TAP1) / (T_M1 - T_TAP1) * (m1s - d1))
    elif t <= T_M1E + 1e-9 and hit1 is None:
        h = 28 + (43.5 - 28) * ss((t - T_M1) / (T_M1E - T_M1))
        tgt = round(h, 1)
        if tgt >= r1: hit1 = t; i = m1e
        else: i = first_reaching(m1s, m1e, tgt)
    elif t < T_TAP2: i = min(m1e + round((t - (hit1 if hit1 is not None else T_M1E)) * FPS), d2 - 1)
    elif t < T_M2: i = d2 + int((t - T_TAP2) / (T_M2 - T_TAP2) * (m2s - d2))
    elif t <= T_M2E + 1e-9:
        h = 43.5 + 9 * ss((t - T_M2) / (T_M2E - T_M2)); i = first_reaching(m2s, m2e, round(h, 1))
    else: i = min(u2 + round((t - T_M2E) * FPS), len(log) - 1)
    plan.append((k, t, i))
# finger track (CSS px) and press state
def finger(t):
    if T_TAP1 - 0.05 <= t <= T_UP1 + 0.6: return ('tap', cfg['stand'], t - T_TAP1, T_UP1 - T_TAP1)
    if T_TAP2 - 0.05 <= t <= T_M2E + 0.6:
        drag_end = T_TAP2 + 0.25
        f = ss((t - T_TAP2) / (drag_end - T_TAP2)); x = cfg['thumb'][0]; y = cfg['thumb'][1] + (cfg['thumbTop'] - cfg['thumb'][1]) * f
        return ('hold', [x, y], t - T_TAP2, T_M2E - T_TAP2)
    return None
def overlay(im, t):
    fz = finger(t)
    if not fz: return im
    kind, (cx, cy), dtp, held = fz
    cx, cy = cx * S, cy * S
    lay = Image.new('RGBA', im.size, (0, 0, 0, 0)); g = ImageDraw.Draw(lay)
    base = 30 * S / 1.7778 * 1.0  # contact radius ~30 CSS px at landscape scale
    base = 30 * S
    # contact disc: fades in over 60ms, holds while pressed, fades 220ms after release
    if dtp < 0: a = max(0, 1 + dtp / 0.05)
    elif dtp <= held: a = min(1, dtp / 0.06 + 0.3)
    else: a = max(0, 1 - (dtp - held) / 0.22)
    press = 1 - 0.12 * min(1, max(0, dtp) / 0.08) if dtp <= held else 0.88 + 0.12 * min(1, (dtp - held) / 0.15)
    rr = base * press
    if a > 0:
        g.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=(255, 255, 255, int(70 * a)), outline=(255, 255, 255, int(200 * a)), width=max(2, int(2.2 * S)))
        g.ellipse([cx - rr * .35, cy - rr * .35, cx + rr * .35, cy + rr * .35], fill=(255, 255, 255, int(120 * a)))
    # ripple rings from the press (and a softer one on release)
    for t0, strength in ((0.0, 1.0), (held, 0.55)):
        u = (dtp - t0) / 0.55
        if 0 <= u <= 1:
            r = base * (1.0 + 2.6 * (1 - (1 - u) ** 3))
            al = int(170 * strength * (1 - u) ** 1.5)
            g.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(200, 220, 255, al), width=max(2, int(3 * S * (1 - 0.5 * u))))
    glow = lay.filter(ImageFilter.GaussianBlur(1.2 * S))
    out = im.convert('RGBA'); out.alpha_composite(glow); out.alpha_composite(lay)
    return out.convert('RGB')
cache = {}
ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-g', '15', '-movflags', '+faststart', outmp4], stdin=subprocess.PIPE)
rows = []
stills = {round(x * FPS) for x in (0.5, 1.07, 3.0, 5.0, 6.6, 7.2, 9.0, 11.5, 16.5)}
for k, t, i in plan:
    si = shot_at(i)
    if si not in cache:
        cache.clear(); cache[si] = Image.open(f"{D}/f{si:05d}.png").convert('RGB').resize((W, H), Image.LANCZOS)
    fr = overlay(cache[si], t)
    ff.stdin.write(fr.tobytes())
    rows.append({'k': k, 't': round(t, 3), 'cap': i, 'shot': si, 'readout': R[si]})
    if stills_dir and k in stills:
        os.makedirs(stills_dir, exist_ok=True); fr.save(f"{stills_dir}/{os.path.basename(outmp4)[:-4]}-t{t:05.2f}s.png")
ff.stdin.close(); ff.wait()
json.dump(rows, open(outmp4[:-4] + '.timing.json', 'w'))
def when(val, lo=0):
    for r in rows[lo:]:
        if r['readout'] is not None and r['readout'] >= val - 1e-6: return r['t']
print('readout first >28.0 at', next(r['t'] for r in rows if r['readout'] and r['readout'] > r0))
print('readout hits', r1, 'at', when(r1), '| 43.5-ish target time 6.4')
print('readout hits', r2, 'at', when(r2), '| target 10.6')
for tt in (1.6, 2.5, 4.0, 5.0, 6.4, 7.4, 8.0, 9.0, 10.0, 10.6):
    r = rows[round(tt * FPS)]; exp = (28 + 15.5 * ss((tt - 1.6) / 4.8)) if tt <= 7 else (43.5 + 9 * ss((tt - 7.4) / 3.2))
    print(f't={tt:5.2f} readout={r["readout"]} expected={exp:.2f}')
