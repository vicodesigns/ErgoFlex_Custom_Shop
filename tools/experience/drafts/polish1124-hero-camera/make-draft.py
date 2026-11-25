#!/usr/bin/env python3
"""polish1124 hero camera: Vico's 20:23 hero camera (export-681ca9360d57, 30 keys) as 10 story keys, one smooth travel.

    python3 tools/experience/drafts/polish1124-hero-camera/make-draft.py <live hero export.json> [out.json]

Reads Vico's own Director export of the hero (Film-chapter-hero-25-95-s- (2).json, imported 2026-11-24 20:23) and
writes the DRAFT next to this file (or to out.json): the same file byte for byte except shots[0].camera.keys.
Every story key is one of HIS keys (his position, aim and lens), most of them untouched:
  plan-00  0.00 s, plan-02  1.40 s, plan-22 16.10 s, plan-27 19.60 s, plan-28 21.60 s, plan-29 25.95 s  exactly his;
  plan-06 -> 4.00 s   (artist B) camera and aim 8 cm higher, 6 % further back: both B screens clear of the top edge;
  plan-10 -> 7.20 s   (architect C) camera and aim 3 cm higher;
  plan-14/15 midway -> 10.15 s (office D) camera and aim 4 cm higher (his 9.8 s and 10.5 s keys ran back and forth);
  plan-19 14.00 s     (office D, the desk lowered) his key.
The 20 keys in between (0.7 s apart, each a small correction) are dropped: the film's camera bake
(camera-spline.mjs: centripetal Catmull-Rom through the story keys, Fritsch-Carlson timing) makes one continuous,
eased travel through his framings. The end-card arrival (21.60 s) and the drift to 25.95 s are his keys unchanged.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
T = 25.95
# (his key id, new time s or None, pedestal m (camera and aim up), dolly (distance factor), blend partner id or None, label or None)
PLAN = [
    ('plan-00', None, 0, 1, None, 'Opening arc (0.00 s), as Vico set it'),
    ('plan-02', None, 0, 1, None, 'Opening arc rises over the artist desk (1.40 s)'),
    ('plan-06', 4.0, .08, 1.06, None, 'Artist desk B: Vico framing, screens clear of the top'),
    ('plan-10', 7.2, .03, 1, None, 'Architect desk C: Vico framing'),
    ('plan-14', 10.15, .04, 1, 'plan-15', 'Office desk D: Vico framing, glide right'),
    ('plan-19', None, 0, 1, None, 'Office desk D: track with the lowered desk (14.00 s)'),
    ('plan-22', None, 0, 1, None, 'Into the gaming desk H (16.10 s)'),
    ('plan-27', None, 0, 1, None, 'Gaming desk H: swing to the end card (19.60 s)'),
    ('plan-28', None, 0, 1, None, None),
    ('plan-29', None, 0, 1, None, None),
]


def key(by, kid, at, ped, dolly, partner, label):
    k = json.loads(json.dumps(by[kid])); v = k['view']
    if partner:
        o = by[partner]['view']
        for f in ('position', 'target'): v[f] = [(a + b) / 2 for a, b in zip(v[f], o[f])]
        v['fov'] = (v['fov'] + o['fov']) / 2
    if dolly != 1: v['position'] = [t + (p - t) * dolly for p, t in zip(v['position'], v['target'])]
    if ped: v['position'][1] += ped; v['target'][1] += ped
    if at is not None: k['time'] = round(at / T, 6)
    if label: k['label'] = label
    return k


def main():
    if len(sys.argv) < 2: sys.exit(__doc__)
    src = sys.argv[1]; raw = open(src, 'rb').read().replace(b'\r\n', b'\n').decode('utf-8')
    cut = json.loads(raw); shot = cut['shots'][0]
    assert shot['id'] == 'hero' and abs(shot['seconds'] - T) < 1e-9, 'not the 25.95 s hero export'
    by = {k['id']: k for k in shot['camera']['keys']}
    keys = [key(by, *p) for p in PLAN]
    for i, k in enumerate(keys):
        k['id'] = f'plan-{i:02d}'; k['easing'] = 'smooth' if i in (0, len(keys) - 1) else 'linear'
    # splice: only the camera block changes, the rest of the file stays byte for byte his
    a = raw.index('\n      "camera": {'); b = raw.index('\n      }', a + 1) + len('\n      }')
    block = json.dumps({'camera': {'keys': keys}}, indent=2, ensure_ascii=False)[1:-2].replace('\n', '\n    ')
    out_txt = raw[:a] + block.rstrip() + raw[b:]
    assert json.loads(out_txt)['shots'][0]['camera']['keys'] == keys
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'ErgoFlex-film-ch12-hero-director-DRAFT-25.95s-smooth-camera.json')
    open(out, 'w', encoding='utf-8', newline='\n').write(out_txt)
    print(f'{len(keys)} camera keys (was {len(shot["camera"]["keys"])}) -> {out}')


if __name__ == '__main__':
    main()
