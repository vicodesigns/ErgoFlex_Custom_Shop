#!/usr/bin/env python3
"""Film chapter <-> the app's Director Mode (experience/), for hand-tuning the camera.

  director-bridge.py link <shot.json> [--shot id] [--base http://localhost:3000] [--html page.html] [--json cut.json]
      <shot.json> may also be a cut (review-cut.json): --shot picks the chapter (oilers has no shots/NN.json).
      --html writes a small page that redirects to the link (a short address to open); --json writes the cut for
      Director Mode's "Import cut".
      Prints an experience/#cut=... link that opens the chapter as a one-chapter client cut: the desk moves
      (motion clips) and the camera's STORY keys (shot.cameraPlan.keys, not the dense spline bake), each with
      its label, so they can be found and dragged in the Director timeline. Director Mode previews the keys with
      its own interpolation (linear between keys here); the film bakes the same keys into one smooth spline
      (camera-spline.mjs), so positions and times carry over, the in-between motion gets smoother.
      Film-only layers (status lights, LED receivers, the monitor clip, stage rig) don't show in Director Mode.

  director-bridge.py import <exported cut.json> <out director-camera.json> [--shot awaken] [--plan shot.json]
      Reads a cut saved with Director Mode's "Export cut" and writes its camera keys back as cameraPlan keys
      (at = time * seconds). Keys keep their 'hold' from the original plan (--plan) when their id is unchanged.
      Its movement clips are written too ('clips', [] when the chapter has none); build-round8-opener.py uses
      <hq>/director-camera.json's keys instead of its own and its clips over its own by id (and retimes the status
      lights from them); build-round8-director.py does the same for <hq>/director-camera-<id>.json (chapters 2-12).
      --plan may be a cut too (picked by --shot).
  The --html page opens on whatever host serves it; from localhost it moves to 127.0.0.1 first (Chrome allows 6
  connections per host, and the :3000 tabs already open on localhost leave the app stuck at "Preparing").
"""
import base64, json, sys

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default



def load_shot(path, shot_id=None):
    d = json.load(open(path))
    if 'shots' not in d: return d
    if shot_id is None: sys.exit(f'{path} is a cut: name the chapter with --shot')
    return next(s for s in d['shots'] if s['id'] == shot_id)


cmd = args.pop(0) if args else ''
if cmd == 'link':
    base = opt('--base', 'http://localhost:3000'); html_out, json_out = opt('--html'), opt('--json')
    shot = load_shot(args[0], opt('--shot'))
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
    enc = base64.urlsafe_b64encode(raw).decode().rstrip('=')
    if json_out: json.dump(cut, open(json_out, 'w'), indent=1)
    if html_out: open(html_out, 'w').write(f'<!doctype html><meta charset="utf-8"><title>{cut["name"]} in Director Mode</title>'
                                            f'<script>if(location.hostname==="localhost")location.hostname="127.0.0.1";else location.replace("/experience/#cut={enc}")</script><p>Opening {cut["name"]} in Director Mode…</p>\n')
    print(f'{base}/experience/#cut={enc}')
elif cmd == 'import':
    shot_id, plan_path = opt('--shot', 'awaken'), opt('--plan')
    cut, out = json.load(open(args[0])), args[1]
    s = next((x for x in cut['shots'] if x['id'] == shot_id), cut['shots'][0])
    T = float(s['seconds'])
    old = {}
    if plan_path:
        for i, k in enumerate(sorted(load_shot(plan_path, shot_id)['cameraPlan']['keys'], key=lambda k: k['at'])): old[f'plan-{i:02d}'] = k
    keys = []
    for k in sorted(s['camera']['keys'], key=lambda k: k['time']):
        v = k['view']; o = old.get(k['id'], {})
        e = {'at': round(k['time'] * T, 3), 'position': v['position'], 'target': v['target'], 'fov': v.get('fov', 35)}
        if k.get('label'): e['label'] = k['label']
        if 'hold' in o: e['hold'] = o['hold']
        keys.append(e)
    clips = (s.get('motion') or {}).get('clips') or []
    json.dump({'source': args[0], 'seconds': T, 'keys': keys, 'clips': clips}, open(out, 'w'), indent=1)
    print(f'{len(keys)} camera keys and {len(clips)} movement clips from Director Mode -> {out}')
else:
    sys.exit(__doc__)
