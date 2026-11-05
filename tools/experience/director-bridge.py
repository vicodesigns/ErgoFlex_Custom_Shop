#!/usr/bin/env python3
"""Film chapter <-> the app's Director Mode (experience/), for hand-tuning the camera.

  director-bridge.py link <shot.json> [--base http://localhost:3000]
      Prints an experience/#cut=... link that opens the chapter as a one-chapter client cut: the desk moves
      (motion clips) and the camera's STORY keys (shot.cameraPlan.keys, not the dense spline bake), each with
      its label, so they can be found and dragged in the Director timeline. Director Mode previews the keys with
      its own interpolation (linear between keys here); the film bakes the same keys into one smooth spline
      (camera-spline.mjs), so positions and times carry over, the in-between motion gets smoother.
      Film-only layers (status lights, LED receivers, the monitor clip, stage rig) don't show in Director Mode.

  director-bridge.py import <exported cut.json> <out director-camera.json> [--shot awaken] [--plan shot.json]
      Reads a cut saved with Director Mode's "Export cut" and writes its camera keys back as cameraPlan keys
      (at = time * seconds). Keys keep their 'hold' from the original plan (--plan) when their id is unchanged.
      build-round8-opener.py uses <hq>/director-camera.json instead of its own keys when that file exists.
"""
import base64, json, sys

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default

cmd = args.pop(0) if args else ''
if cmd == 'link':
    base = opt('--base', 'http://localhost:3000')
    shot = json.load(open(args[0]))
    plan = sorted(shot['cameraPlan']['keys'], key=lambda k: k['at'])
    T = float(shot['seconds'])
    if len(plan) > 64: sys.exit(f'{len(plan)} story keys; Director Mode keeps 64')
    aspect = 16 / 9
    keys = [{'id': f'plan-{i:02d}', 'time': round(k['at'] / T, 6), 'label': (k.get('label') or f'Key {i + 1} at {k["at"]:.1f} s')[:60],
             'easing': 'smooth' if i in (0, len(plan) - 1) else 'linear',
             'view': {'position': [round(x, 4) for x in k['position']], 'target': [round(x, 4) for x in k['target']], 'fov': k.get('fov', 35), 'aspect': aspect}}
            for i, k in enumerate(plan)]
    s = {k: shot[k] for k in ('id', 'room', 'kind', 'seconds', 'title', 'detail', 'preset', 'transition', 'size', 'layout', 'mode') if k in shot}
    s['seconds'] = min(90, s['seconds'])
    if shot.get('motion'): s['motion'] = shot['motion']
    s['camera'] = {'keys': keys}
    cut = {'schema': 'ergoflex.client-cut', 'version': 1, 'id': f'film-{shot["id"]}', 'name': f'Film chapter: {shot["id"]} ({T:g} s)',
           'client': 'ErgoFlex intro film', 'volume': .32, 'shots': [s]}
    raw = json.dumps(cut, separators=(',', ':')).encode()
    if len(raw) > 45000: sys.exit(f'cut is {len(raw)} bytes; links hold 45000. Use Import cut with the JSON instead.')
    print(f'{base}/experience/#cut=' + base64.urlsafe_b64encode(raw).decode().rstrip('='))
elif cmd == 'import':
    shot_id, plan_path = opt('--shot', 'awaken'), opt('--plan')
    cut, out = json.load(open(args[0])), args[1]
    s = next((x for x in cut['shots'] if x['id'] == shot_id), cut['shots'][0])
    T = float(s['seconds'])
    old = {}
    if plan_path:
        for i, k in enumerate(sorted(json.load(open(plan_path))['cameraPlan']['keys'], key=lambda k: k['at'])): old[f'plan-{i:02d}'] = k
    keys = []
    for k in sorted(s['camera']['keys'], key=lambda k: k['time']):
        v = k['view']; o = old.get(k['id'], {})
        e = {'at': round(k['time'] * T, 3), 'position': v['position'], 'target': v['target'], 'fov': v.get('fov', 35)}
        if k.get('label'): e['label'] = k['label']
        if 'hold' in o: e['hold'] = o['hold']
        keys.append(e)
    json.dump({'source': args[0], 'seconds': T, 'keys': keys}, open(out, 'w'), indent=1)
    print(f'{len(keys)} camera keys from Director Mode -> {out}')
else:
    sys.exit(__doc__)
