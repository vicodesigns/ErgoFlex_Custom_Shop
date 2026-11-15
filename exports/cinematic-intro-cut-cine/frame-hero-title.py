#!/usr/bin/env python3
"""The finale's closing title ("One desk. Every part of your day.", 34.47-39.78 s, lower left): the architect sub-shot
(shots/13-subshots.json, renderRange 33.2-48 s, the one on screen while the title is up) is aimed a little left so the
desk's near leg clears the end of the headline (about 37.1 s it touched "day."). Only that sub-shot's camera changes:
its aim turns left about the vertical by DX of the frame width (frame_right in build-cine-cut.py), eased in over
34.2-34.8 s (after the crossfade from the occ desk) and out over 39.4-40.4 s (before the end card), so the slow arc
stays one move. The other five sub-shots and review-cut.json's hero camera stay as they were (identical to each
other); none of them is on screen in that window.

    python exports/cinematic-intro-cut-cine/frame-hero-title.py          # in place; running it twice changes nothing
"""
import importlib.util, json, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
SUB = os.path.join(HERE, 'shots', '13-subshots.json')
CUT = os.path.join(HERE, 'review-cut.json')
DX, RAMP = 0.05, ((34.2, 34.8), (39.4, 40.4))
spec = importlib.util.spec_from_file_location('bcc', os.path.join(HERE, 'build-cine-cut.py'))
bcc = importlib.util.module_from_spec(spec); spec.loader.exec_module(bcc)


def smooth(a, b, t):
    u = min(1, max(0, (t - a) / (b - a))); return u * u * (3 - 2 * u)


def weight(t):
    (a0, a1), (b0, b1) = RAMP
    return smooth(a0, a1, t) * (1 - smooth(b0, b1, t))


def main():
    raw = open(SUB, 'rb').read().replace(b'\r\n', b'\n'); sub = json.loads(raw)
    hero = [s for s in json.load(open(CUT, encoding='utf-8'))['shots'] if s['id'] == 'hero'][0]
    arch = [s for s in sub['shots'] if s.get('preset') == 'architect']
    assert len(arch) == 1, 'one architect sub-shot'
    s = arch[0]; T = s['seconds']
    base = hero['camera']['keys']                     # the untouched path (review-cut.json's hero, = every sub-shot's)
    assert [k['time'] for k in base] == [k['time'] for k in s['camera']['keys']]
    keys = []
    for k in base:
        k = json.loads(json.dumps(k)); w = weight(k['time'] * T)
        if w > 0:
            v = bcc.frame_right({'position': k['view']['position'], 'target': k['view']['target'], 'fov': k['view']['fov']}, DX * w)
            k['view']['target'] = v['target']
        keys.append(k)
    s['camera']['keys'] = keys
    out = json.dumps(sub).encode()
    if out != raw: open(SUB, 'wb').write(out)
    print('architect sub-shot: aim turned by up to', DX, 'of the width over', RAMP, '; keys changed:', sum(1 for k in base if weight(k['time'] * T) > 0))


if __name__ == '__main__':
    main()
