#!/usr/bin/env python3
"""Director Mode round trip for chapters 2-12 (chapter 1, awaken, stays with build-round8-opener.py).

  build-round8-director.py <hq dir>
      The pass. Runs LAST in the builder chain (leds -> opener -> rise -> wellness -> create-commons -> this), under
      flock /tmp/claude-1000/hq14-cut.lock. For every chapter but awaken with <hq>/director-camera-<id>.json
      (director-bridge.py import re, --shot <id> --plan <its shot>):
      - seconds = the import's (the render length: shots/NN.json; a review-cut chapter trimmed shorter than its render
        (coast, music, media) keeps its trim, clamped to the new length). A length change is reported: the EDL and
        the score are NOT retimed here.
      - cameraPlan.keys = the import's keys (hold and cut kept by director-bridge --plan), the plan's other fields kept;
        camera re-baked from it with camera-spline.mjs.
      - motion clips overridden by id from the import ('clips'): fields id lane kind start duration easing label
        target value direction path; clips he added are kept, clips he deleted are dropped.
      - ledStatus re-timed for the clips whose start/duration changed (or that he deleted), see retime_status().
      - motion.initial height / tilt = the import's 'initial' (the Chapter tab's Starting position; x / z / yaw kept),
        see start_pose(); a lift / tilt move that now runs the other way swaps its status light's colour pair.
      Writes the chapter's shots/NN.json (oilers has none: review-cut only), its review-cut.json entry and, for hero,
      every sub-shot in shots/13-subshots.json (renderRange kept; the last one follows a length change). Files are
      only rewritten when their content changes, so chapters without a director file are left byte-for-byte alone.
      rise, wellness, create and commons: their builders leave the camera (cameraPlan + camera) to this pass when the
      director file exists (create's builder still resets its authored motion + ledStatus, which this pass re-times).

  build-round8-director.py <hq dir> --pages [id ...] [--downloads DIR]
      Director pages + import files (all chapters if no id): <hq>/director-chNN-<id>.html (chapter 1:
      director-ch01.html) and DIR/ErgoFlex-film-chNN-<id>-director.json (DIR default ~/Downloads), and
      <hq>/director-index.html linking every chapter page. Open via http://127.0.0.1:3000/<hq>/director-index.html.
      Every page cut gets 'filmVersion' (hash of the cut) and 'filmUpdated' (UTC time that version was first built),
      its director-chapters.json entry the same as 'version' / 'updated': a reloaded Director tab takes the newer page cut (experience/film-fresh.mjs).

  build-round8-director.py <hq dir> --import <exported cut.json>
      Reads the chapter id from the export, runs director-bridge.py import into director-camera.json (awaken) or
      director-camera-<id>.json with --shot <id> --plan <its shot>, prints the id. Run it under the cut lock.
      Film titles: an export whose shot has 'filmTitles' (Director Mode's Titles lane / Title inspector: copy, in / out,
      shadow) rewrites that chapter's entries in <hq>/titles-src.json (backup first: titles-src.pre-director-<id>-<time>.json;
      unchanged titles leave the file alone). Titles he retimed get director_timing: true, which titles-after-cut.py
      keeps as set (it only flags a break of the 1.5 s-after-cut rule).
      Desk versions (hero): an export whose shot has 'deskVersions' ([{n, preset, name, start, end}] in time order: the six
      sub-shots' desk model, label and renderRange) keeps them in director-camera-hero.json as 'versions' (an export without
      the field keeps the earlier import's). The pass rewrites shots/13-subshots.json (preset, renderRange, name and the
      model's dressing per sub-shot) and the film shot's subshots map + presets (tools/experience/desk-versions-apply.mjs).
      Props: an export whose shot has 'propEdits' (Director Mode's Props: move / turn / scale / hide, film sceneEdits
      format, experience/prop-edits.mjs) keeps them in director-camera-<id>.json as 'props' (an export without the
      field keeps the props imported before). The pass writes them into the chapter's sceneEdits after the hand-made
      ones, each marked director: true, replacing the earlier director: true entries; the builders' and
      film-cameras sceneEditsAdd entries are never touched, and the Director's entries are offsets from the film's
      placement, so they keep what Vico saw however the hand-made edits for that prop change.
      Branding: an export whose shot has 'brandingEdits' (Director Mode's Branding tab: the school stickers / logos of
      every desk in the room, experience/branding-edits.mjs) keeps them in director-camera-<id>.json as 'branding' (an
      export without the field keeps the branding imported before). The pass writes them onto the chapter's film shot
      (review-cut.json and the chapter's shot file) as 'sceneBranding'; render-cut passes it to film-fx.
      Desks: an export whose shot has 'deskEdits' (Director Mode's Desks: size, place and starting height / tilt of the
      room's other ErgoFlex desks, experience/desk-edits.mjs; later per-desk moves and builds) keeps them in
      director-camera-<id>.json as 'desks' (an export without the field keeps the earlier import's). The pass writes them
      onto the chapter's film shot as 'sceneDeskEdits' (tools/experience/film-desk-edits.mjs installs them).
"""
import base64, copy, glob, hashlib, html, json, os, re, subprocess, sys, tempfile, time
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))   # the repo

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SPLINE, BRIDGE = os.path.join(HERE, 'camera-spline.mjs'), os.path.join(HERE, 'director-bridge.py')
CLIP_FIELDS = ('id', 'lane', 'kind', 'start', 'duration', 'easing', 'label', 'target', 'value', 'direction', 'path')
LANE_OF = {'lift-up': 'lift', 'lift-down': 'lift', 'tilt-retract': 'tilt', 'tilt-extend': 'tilt', 'wheels': 'wheels'}
FLIP = {'lift-up': 'lift-down', 'lift-down': 'lift-up', 'tilt-retract': 'tilt-extend', 'tilt-extend': 'tilt-retract'}
EPS = .02

args = sys.argv[1:]
if not args: sys.exit(__doc__)
H = args.pop(0)
CUT = os.path.join(H, 'review-cut.json')


def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default


def load(p): return json.load(open(p))


def dump(p, d, indent=1):
    """Write only when the content changes (keeps untouched files byte-identical)."""
    if os.path.exists(p) and load(p) == d: return False
    json.dump(d, open(p, 'w'), indent=indent); return True


def chapters():
    """[(NN, id, shot file or None)] in film order (NN = the chapter's place in review-cut.json)."""
    files = {}
    for f in sorted(glob.glob(os.path.join(H, 'shots', '[0-9][0-9].json'))):
        d = load(f)
        if 'id' in d and 'shots' not in d: files.setdefault(d['id'], f)
    return [(i + 1, s['id'], files.get(s['id'])) for i, s in enumerate(load(CUT)['shots'])]


def director_file(cid): return os.path.join(H, 'director-camera.json' if cid == 'awaken' else f'director-camera-{cid}.json')


def plan_source(cid, f): return f or CUT     # director-bridge reads a cut with --shot too


def bake(seconds, plan):
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as t:
        json.dump({'seconds': seconds, 'cameraPlan': plan}, t); tmp = t.name
    try:
        subprocess.run(['node', SPLINE, tmp], check=True, stdout=subprocess.DEVNULL)
        return load(tmp)['camera']
    finally:
        os.unlink(tmp)


def r4(x): return round(float(x), 4)


def merge_clips(old, new):
    mine = {c['id']: c for c in old}; out = []
    for d in sorted(new, key=lambda c: (c['start'], c.get('lane', ''))):
        c = copy.deepcopy(mine.get(d['id'], {}))
        c.update({k: copy.deepcopy(v) for k, v in d.items() if k in CLIP_FIELDS})
        c['start'], c['duration'] = r4(c['start']), r4(c['duration'])
        out.append(c)
    return out


def directions(clips, initial):
    """Each lift/tilt clip's direction (+1 up / -1 down) from the pose before it."""
    pose = {'lift': (initial or {}).get('height', 28), 'tilt': (initial or {}).get('tilt', 0)}; out = {}
    for c in sorted(clips, key=lambda c: c['start']):
        if c.get('lane') in pose and isinstance(c.get('target'), (int, float)):
            out[c['id']] = 1 if c['target'] >= pose[c['lane']] else -1; pose[c['lane']] = c['target']
    return out


def start_pose(initial, mine, log):
    """The Chapter tab's Starting position (Director's motion.initial height / tilt) over the film's start pose; its
    wheels start (x, z, yaw) is kept. Clips are untouched: each still runs from the pose before it to its target."""
    out = dict(initial)
    for k, lo, hi in (('height', 28, 52.5), ('tilt', -5, 65)):
        v = mine.get(k)
        if isinstance(v, (int, float)) and not isinstance(v, bool): out[k] = round(min(hi, max(lo, float(v))), 3)
    for k in ('height', 'tilt'):
        if isinstance(out.get(k), float) and out[k] == int(out[k]): out[k] = int(out[k])
    if (out.get('height'), out.get('tilt')) != (initial.get('height'), initial.get('tilt')):
        log(f'    starting position {initial.get("height")}" / {initial.get("tilt")} deg -> {out["height"]}" / {out["tilt"]} deg')
    return out


def retime_status(events, old_clips, new_clips, old_T, new_T, initial, log, new_initial=None):
    """Status lights after his movement edits. An event belongs to the clip on its lane (lift-*, tilt-*, wheels) that
    is running when it starts (the one starting with it first, else the latest started). For a clip he moved or
    stretched, its events map linearly from the old span to the new one (commons' one drive keeps its mode-6 ->
    mode-3 split at the same fraction); an event that ended early because the next light took over ends with its
    clip, and the hand-over is re-applied: a later move takes the light at its start, like the opener. A deleted
    clip takes its lights with it. A light that starts as a moved clip ends (awareness: the proximity warning when
    the roll arrives) follows that end. Kind/colour/fade/mode are kept; only a move he reversed (lift up <-> down, tilt
    up <-> down) swaps to the other colour of the pair. Clips he added get no light. A light that ran to the chapter
    end still does. Nothing changes when no clip timing changed and the length is the same."""
    old_by, new_by = {c['id']: c for c in old_clips}, {c['id']: c for c in new_clips}
    end = lambda c: c['start'] + c['duration']
    changed = {i for i, c in old_by.items() if i not in new_by or abs(new_by[i]['start'] - c['start']) > 1e-4
               or abs(new_by[i]['duration'] - c['duration']) > 1e-4}
    d_old, d_new = directions(old_clips, initial), directions(new_clips, initial if new_initial is None else new_initial)
    reversed_ = {i for i in d_old if i in d_new and d_old[i] != d_new[i]}
    if not events or (not changed and not reversed_ and abs(new_T - old_T) < 1e-6): return events
    starts = [e['at'] for e in events]

    def owner(e):
        lane = LANE_OF.get(e.get('kind'))
        run = [c for c in old_clips if c.get('lane') == lane and c['start'] - EPS <= e['at'] < end(c) - EPS]
        same = [c for c in run if abs(c['start'] - e['at']) < EPS]
        return (same or sorted(run, key=lambda c: c['start'])[-1:] or [None])[0]

    out = []
    for e in events:
        e = dict(e); at, stop = e['at'], e['at'] + e['dur']; o = owner(e)
        to_end = abs(stop - old_T) < EPS and (o is None or o['id'] not in changed)
        handover = any(abs(stop - s) < EPS for s in starts if abs(s - at) >= EPS)
        if o is not None:
            n = new_by.get(o['id'])
            if n is None: log(f'    light {e["kind"]} {at:g}+{e["dur"]:g} dropped with deleted clip {o["id"]}'); continue
            if o['id'] in reversed_ and e['kind'] in FLIP:
                log(f'    light {e["kind"]} -> {FLIP[e["kind"]]}: {o["id"]} now moves the other way'); e['kind'] = FLIP[e['kind']]
            if o['id'] in changed:
                k = n['duration'] / o['duration']; m = lambda t: n['start'] + (t - o['start']) * k
                at2 = m(at); stop2 = end(n) if (handover and stop < end(o) - EPS) or abs(stop - end(o)) < EPS else m(stop)
            else:
                at2, stop2 = at, (end(o) if handover and stop < end(o) - EPS else stop)
        else:
            lead = [c for c in old_clips if c['id'] in changed and c['id'] in new_by and abs(end(c) - at) < EPS]
            at2 = end(new_by[lead[0]['id']]) if lead else at
            stop2 = at2 + e['dur']
        if to_end: stop2 = new_T
        e['at'], e['_stop'] = round(at2, 3), stop2
        out.append(e)
    out.sort(key=lambda e: e['at'])
    for e, nx in zip(out, out[1:] + [None]):
        stop = min(e.pop('_stop'), new_T, nx['at'] if nx else new_T)
        e['dur'] = round(stop - e['at'], 3)
    return [e for e in out if e['dur'] > 1e-3]


def apply(n, cid, f, dc, log):
    cut = load(CUT); ci = next(i for i, s in enumerate(cut['shots']) if s['id'] == cid)
    src = load(f) if f else cut['shots'][ci]
    old_T, new_T = float(src['seconds']), float(dc['seconds'])
    new_T = int(new_T) if new_T == int(new_T) else new_T
    plan = dict(src.get('cameraPlan') or {}); plan['keys'] = dc['keys']
    bad = [k['at'] for k in dc['keys'] if not -1e-6 <= k['at'] <= new_T + 1e-6]
    if bad: sys.exit(f'{cid}: camera keys at {bad} lie outside the {new_T} s chapter')
    camera = bake(new_T, plan)
    motion, status = src.get('motion'), src.get('ledStatus')
    old_initial = copy.deepcopy((motion or {}).get('initial'))
    if 'clips' in dc and (motion or dc['clips']):
        motion = dict(motion or {'version': 2, 'initial': {'height': 30, 'tilt': 0, 'x': 0, 'z': 0, 'yaw': 0}})
        old_clips = motion.get('clips') or []
        motion['clips'] = merge_clips(old_clips, dc['clips'])
        late = [c['id'] for c in motion['clips'] if c['start'] + c['duration'] > new_T + 1e-4]
        if late: sys.exit(f'{cid}: clips {late} run past the {new_T} s chapter')
        if isinstance(dc.get('initial'), dict) and motion.get('initial'):
            motion['initial'] = start_pose(motion['initial'], dc['initial'], log)
        if status: status = retime_status(status, old_clips, motion['clips'], old_T, new_T, old_initial, log, motion.get('initial'))
        gone = sorted({c['id'] for c in old_clips} - {c['id'] for c in motion['clips']})
        added = sorted({c['id'] for c in motion['clips']} - {c['id'] for c in old_clips})
        moved = [c['id'] for c in old_clips if c['id'] not in gone and next(x for x in motion['clips'] if x['id'] == c['id']) != c]
        if gone or added or moved: log(f'    clips: changed {moved or "-"}, deleted {gone or "-"}, added {added or "-"} (added clips get no status light)')
    elif 'clips' not in dc: log('    import has no clips: motion and status lights left as they are')
    if motion is not None and isinstance(dc.get('initial'), dict) and not ('clips' in dc and (src.get('motion') or dc['clips'])):
        motion = dict(motion); motion['initial'] = start_pose(motion.get('initial') or {'height': 30, 'tilt': 0, 'x': 0, 'z': 0, 'yaw': 0}, dc['initial'], log)

    def put(s, seconds):
        s['seconds'] = seconds; s['cameraPlan'] = copy.deepcopy(plan); s['camera'] = copy.deepcopy(camera)
        if motion is not None: s['motion'] = copy.deepcopy(motion)
        if status is not None: s['ledStatus'] = copy.deepcopy(status)
        rr, m = s.get('renderRange'), s.get('subshots')      # hero: the last sub-shot follows a length change
        if rr and abs(rr[1] - old_T) < 1e-6: s['renderRange'] = [rr[0], new_T]
        if isinstance(m, dict) and m:
            last = max(m, key=lambda k: m[k][1])
            if abs(m[last][1] - old_T) < 1e-6: m[last] = [m[last][0], new_T]
        return s

    wrote = []
    cut_T = float(cut['shots'][ci]['seconds'])
    trimmed = f is not None and cut_T < old_T - 1e-6        # coast, music, media: the film keeps the head of a longer render
    new_cut_T = min(cut['shots'][ci]['seconds'], new_T) if trimmed else new_T
    if f:
        sh = load(f)
        if dump(f, put(sh, new_T)): wrote.append(os.path.relpath(f, H))
    cut['shots'][ci] = put(cut['shots'][ci], new_cut_T)
    if dump(CUT, cut): wrote.append('review-cut.json')
    if cid == 'hero':
        sp = os.path.join(H, 'shots', '13-subshots.json')
        if os.path.exists(sp):
            sub = load(sp)
            for s in sub['shots']:
                if s.get('id') != 'hero': continue
                put(s, new_T)
                if s['renderRange'][0] >= new_T or s['renderRange'][1] > new_T + 1e-6:
                    log(f'    sub-shot {s.get("subshot")} renderRange {s["renderRange"]} lies past the {new_T:g} s chapter')
            if dump(sp, sub, indent=None): wrote.append('shots/13-subshots.json')
        log('    hero: the preset seams (sub-shot renderRanges, the main shot\'s subshots map) are NOT moved with the clips')
    if abs(new_T - old_T) > 1e-6:
        log(f'    LENGTH CHANGED {old_T:g} -> {new_T:g} s' + (f' (render; the film trim stays {new_cut_T:g} s)' if trimmed else '')
            + ': edl.json / the score still have the old timing')
    return wrote


LIGHT_FIELDS = ('ledStatus', 'ledNeutral', 'ledColor', 'lights', 'lightEdits', 'timeOfDay')   # + Scene lights, Time of day (HQ29/32)
# The Lighting tab's Room section: Room's own light / Room brightness / Fill light / LED glow on the walls / LED glow on the floor
# (ledWallGlow / ledFloorGlow: x the film's approved LED room spill and floor light; film-fx.mjs sceneGlobals).
GLOBAL_FIELDS = ('roomLight', 'exposureScale', 'environmentScale', 'ledWallGlow', 'ledFloorGlow', 'ledFloorSources')


def apply_lighting(cid, f, lighting):
    """HQ29: Director Mode's Lighting lane (Export cut carries ledStatus / ledNeutral / ledColor / sceneGlobals.roomLight
    in the film's own shapes). Vico's values win over the builders': written last, into every copy of the chapter."""
    paths = [CUT] + ([f] if f else []) + ([os.path.join(H, 'previews', 'awaken-v5-cut.json')] if cid == 'awaken' else [])
    wrote = []
    for p in paths:
        if not os.path.exists(p): continue
        d = load(p)
        for s in (d['shots'] if 'shots' in d else [d]):
            if s.get('id') != cid: continue
            for k in LIGHT_FIELDS:
                if k not in lighting: continue
                if k == 'lights':   # the Director's own lights (director-*) are ADDED to the film's; same name replaces
                    mine = copy.deepcopy(lighting['lights']); names = {l.get('name') for l in mine}
                    s['lights'] = [l for l in s.get('lights') or [] if not str(l.get('name', '')).startswith('director-') and l.get('name') not in names] + mine
                else: s[k] = copy.deepcopy(lighting[k])
            for k in GLOBAL_FIELDS:
                if k in lighting: s.setdefault('sceneGlobals', {})[k] = copy.deepcopy(lighting[k])
        if dump(p, d): wrote.append(os.path.relpath(p, H))
    return wrote


PROP_FIELDS = ('match', 'asset', 'path', 'near', 'label', 'space', 'position', 'rotation', 'scale', 'hide')


ADD_ASSET = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$')
ADD_ID = re.compile(r'^[A-Za-z0-9]{1,16}$')


def clean_add(e):
    """An added library prop (experience/prop-edits.mjs cleanAddEdit): {add: {asset}, id, match, label, parent, position,
    rotation, scale}, its own transform in the parent's frame (desk: rides the desktop; room: the room)."""
    add = e.get('add'); asset = add if isinstance(add, str) else add.get('asset') if isinstance(add, dict) else None
    if not isinstance(asset, str) or not ADD_ASSET.match(asset) or not isinstance(e.get('id'), str) or not ADD_ID.match(e['id']): return None
    num = lambda x: isinstance(x, (int, float)) and not isinstance(x, bool)
    vec = lambda v, d: [x for x in v] if isinstance(v, list) and len(v) == 3 and all(num(x) and abs(x) < 1e4 for x in v) else d
    name = f'Added prop:{asset}#{e["id"]}'
    d = {'add': {'asset': asset}, 'id': e['id'], 'match': '^' + re.sub(r'([.*+?^${}()|\[\]\\/])', r'\\\1', name) + '$'}
    if isinstance(e.get('label'), str) and len(e['label']) <= 120: d['label'] = e['label']
    d['parent'] = 'desk' if e.get('parent') == 'desk' else 'room'
    d['position'] = vec(e.get('position'), [0, 0, 0]); d['rotation'] = vec(e.get('rotation'), [0, 0, 0])
    sc = vec(e.get('scale'), None)
    d['scale'] = sc if sc and all(.001 <= x <= 1000 for x in sc) else [1, 1, 1]
    d['director'] = True
    return d


def clean_props(props):
    """Director Mode's prop edits (experience/prop-edits.mjs cleanPropEdit), as film sceneEdits marked director: true."""
    out = []
    vec = lambda v: isinstance(v, list) and len(v) == 3 and all(isinstance(x, (int, float)) and not isinstance(x, bool) and abs(x) < 1e4 for x in v)
    for e in props if isinstance(props, list) else []:
        if isinstance(e, dict) and e.get('add') is not None:
            a = clean_add(e)
            if a: out.append(a)
            continue
        if not isinstance(e, dict) or not isinstance(e.get('match'), str): continue
        d = {k: copy.deepcopy(e[k]) for k in PROP_FIELDS if k in e}
        for k in ('near', 'position', 'rotation', 'scale'):
            if k in d and not vec(d[k]): d.pop(k)
        if 'hide' in d and not isinstance(d['hide'], bool): d.pop('hide')
        for k in ('asset', 'path', 'label'):
            if k in d and not isinstance(d[k], str): d.pop(k)
        if d.get('space') != 'local' or 'position' not in d: d.pop('space', None)
        if not any(k in d for k in ('position', 'rotation', 'scale', 'hide')): continue
        d['director'] = True; out.append(d)
    return out


def apply_props(cid, f, props):
    """The chapter's sceneEdits: its hand-made entries as they are, then the Director's (replacing earlier director: true)."""
    mine = clean_props(props)
    paths = [CUT] + ([f] if f else []) + ([os.path.join(H, 'previews', 'awaken-v5-cut.json')] if cid == 'awaken' else [])
    wrote = []
    for p in paths:
        if not os.path.exists(p): continue
        d = load(p)
        for s in (d['shots'] if 'shots' in d else [d]):
            if s.get('id') != cid: continue
            hand = [e for e in s.get('sceneEdits') or [] if not e.get('director')]
            if hand or mine: s['sceneEdits'] = hand + copy.deepcopy(mine)
            else: s.pop('sceneEdits', None)
        if dump(p, d): wrote.append(os.path.relpath(p, H))
    return wrote


BRANDING_FIELDS = {'surface': str, 'enabled': bool, 'x': (-100, 200), 'y': (-100, 200), 'scale': (5, 300), 'rotation': (-180, 180)}


def clean_branding(b):
    """Director Mode's branding overlay (experience/branding-edits.mjs cleanBranding): {room, artwork:{version, surfaces}}; None if not one."""
    if not isinstance(b, dict) or not isinstance(b.get('room'), str) or not re.fullmatch(r'[a-z0-9-]{1,40}', b['room']): return None
    surfaces, n = {}, 0
    for sid, layers in ((b.get('artwork') or {}).get('surfaces') or {}).items():
        if not isinstance(layers, dict) or not re.fullmatch(r'[a-z-]{1,40}', sid or ''): continue
        for key, e in layers.items():
            if not re.fullmatch(r'(logo|texture)(-[2-8])?', key) or not isinstance(e, dict) or n >= 64: continue
            d = {}
            if isinstance(e.get('name'), str) and len(e['name']) <= 160: d['name'] = e['name']
            if isinstance(e.get('surface'), str) and re.fullmatch(r'[a-z-]{1,40}', e['surface']): d['surface'] = e['surface']
            if isinstance(e.get('enabled'), bool): d['enabled'] = e['enabled']
            for k, (lo, hi) in ((k, v) for k, v in BRANDING_FIELDS.items() if isinstance(v, tuple)):
                v = e.get(k)
                if isinstance(v, (int, float)) and not isinstance(v, bool): d[k] = round(min(hi, max(lo, v)), 2)
            if any(k in d for k in BRANDING_FIELDS): surfaces.setdefault(sid, {})[key] = d; n += 1
    return {'room': b['room'], 'artwork': {'version': 1, 'surfaces': surfaces}}


def apply_branding(cid, f, branding):
    """The chapter's film shot gets sceneBranding (film-fx installs it on every desk of the room); an empty overlay removes it."""
    mine = clean_branding(branding)
    paths = [CUT] + ([f] if f else []) + ([os.path.join(H, 'previews', 'awaken-v5-cut.json')] if cid == 'awaken' else [])
    wrote = []
    for p in paths:
        if not os.path.exists(p): continue
        d = load(p)
        for s in (d['shots'] if 'shots' in d else [d]):
            if s.get('id') != cid: continue
            if mine and mine['artwork']['surfaces']: s['sceneBranding'] = copy.deepcopy(mine)
            else: s.pop('sceneBranding', None)
        if dump(p, d): wrote.append(os.path.relpath(p, H))
    return wrote


DESK_ID = re.compile(r'^[a-z][a-z0-9-]{0,79}$')
DESK_SIZES = ('48x30', '60x30')


def clean_desks(desks):
    """Director Mode's desk edits (experience/desk-edits.mjs cleanDeskEdit) as the film shot's sceneDeskEdits. Size, pose and
    initial are checked here; clips (DeskChoreo) and build (DeskBuild) pass through as the Director cleaned them."""
    num = lambda x: isinstance(x, (int, float)) and not isinstance(x, bool) and x == x and abs(x) != float('inf')
    out = {}
    for e in desks if isinstance(desks, list) else []:
        if not isinstance(e, dict) or not isinstance(e.get('desk'), str) or not DESK_ID.match(e['desk']): continue
        d = {'desk': e['desk']}
        if isinstance(e.get('name'), str) and 0 < len(e['name']) <= 80: d['name'] = e['name']
        if e.get('size') in DESK_SIZES: d['size'] = e['size']
        p = e.get('pose')
        if isinstance(p, dict) and all(num(p.get(k)) for k in ('x', 'z', 'yaw')): d['pose'] = {k: p[k] for k in ('x', 'z', 'yaw')}
        i = e.get('initial')
        if isinstance(i, dict) and all(num(i.get(k)) for k in ('height', 'tilt')): d['initial'] = {k: i[k] for k in ('height', 'tilt')}
        if isinstance(e.get('clips'), list) and e['clips'] and all(isinstance(c, dict) for c in e['clips']): d['clips'] = copy.deepcopy(e['clips'])
        if isinstance(e.get('build'), dict) and e['build']: d['build'] = copy.deepcopy(e['build'])
        if any(k not in ('desk', 'name') for k in d): out[d['desk']] = d
    return list(out.values())


def clean_build(b):
    """A desk build as the Director cleaned it (experience/desk-build.mjs cleanDeskBuild): finishes, trim, [{id, slot}]."""
    if not isinstance(b, dict): return None
    out = {}
    for k in ('woodFinish', 'baseFinish'):
        if isinstance(b.get(k), str) and 0 < len(b[k]) <= 60: out[k] = b[k]
    if isinstance(b.get('trimColor'), str) and re.match(r'^#[0-9a-fA-F]{6}$', b['trimColor']): out['trimColor'] = b['trimColor'].lower()
    if isinstance(b.get('accessories'), list):
        acc = [{'id': a['id'], 'slot': a['slot']} for a in b['accessories'][:60] if isinstance(a, dict) and isinstance(a.get('id'), str)
               and a.get('slot') in ('desktop', 'shelf', 'lower-shelf', 'base-shelf')]
        out['accessories'] = acc
    return out or None


def apply_desks(cid, f, desks):
    """The chapter's film shot gets sceneDeskEdits (the Director's desk edits); none removes the field."""
    mine = clean_desks(desks)
    paths = [CUT] + ([f] if f else []) + ([os.path.join(H, 'previews', 'awaken-v5-cut.json')] if cid == 'awaken' else [])
    wrote = []
    for p in paths:
        if not os.path.exists(p): continue
        d = load(p)
        for s in (d['shots'] if 'shots' in d else [d]):
            if s.get('id') != cid: continue
            if mine: s['sceneDeskEdits'] = copy.deepcopy(mine)
            else: s.pop('sceneDeskEdits', None)
        if dump(p, d): wrote.append(os.path.relpath(p, H))
    return wrote


def apply_featured_build(cid, f, build):
    """The chapter's film shot gets featuredBuild (the Director's Build tab on the featured desk); none removes the field."""
    paths = [CUT] + ([f] if f else []) + ([os.path.join(H, 'previews', 'awaken-v5-cut.json')] if cid == 'awaken' else [])
    wrote = []
    for p in paths:
        if not os.path.exists(p): continue
        d = load(p)
        for s in (d['shots'] if 'shots' in d else [d]):
            if s.get('id') != cid: continue
            if build: s['featuredBuild'] = copy.deepcopy(build)
            else: s.pop('featuredBuild', None)
        if dump(p, d): wrote.append(os.path.relpath(p, H))
    return wrote


def clean_versions(v):
    """Desk versions as the Director cleaned them (experience/desk-versions-edit.mjs cleanDeskVersionList): hero's six
    desks [{n, preset, name, start, end}] in time order, or None."""
    if not isinstance(v, list) or not 2 <= len(v) <= 12: return None
    out = []
    for e in v:
        if not isinstance(e, dict) or not re.match(r'^[A-Z]$', str(e.get('n', ''))) or not re.match(r'^[a-z0-9-]{1,40}$', str(e.get('preset', ''))): return None
        try: a, b = float(e['start']), float(e['end'])
        except (KeyError, TypeError, ValueError): return None
        if not (0 <= a < b <= 600): return None
        out.append({'n': e['n'], 'preset': e['preset'], 'name': re.sub(r'[\x00-\x1f]', ' ', str(e.get('name') or '')).strip()[:40],
                    'start': round(a, 2), 'end': round(b, 2)})
    if len({e['n'] for e in out}) != len(out): return None
    return sorted(out, key=lambda e: (e['start'], e['n']))


def apply_versions(cid, f, versions):
    """Chapter 12 (hero): the Director's Desk versions (order, length, model, name) -> shots/13-subshots.json (each
    sub-shot's preset, renderRange, name and the model's own dressing: experience/desk-versions-edit.mjs, run through
    node so the film and the live stage resolve the same thing) and the film shot's subshots map + presets (review-cut.json,
    shots/13.json). Idempotent. The slots keep the camera, light rig and desk performance; seams stay at overlap midpoints."""
    sp = os.path.join(H, 'shots', '13-subshots.json')
    if cid != 'hero' or not os.path.exists(sp): return []
    sub = load(sp)
    r = subprocess.run(['node', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'desk-versions-apply.mjs')],
                       input=json.dumps({'subshots': sub['shots'], 'versions': versions}), capture_output=True, text=True)
    if r.returncode: sys.exit(f'{cid}: desk versions could not be applied: {r.stderr.strip().splitlines()[-1] if r.stderr.strip() else r.returncode}')
    out = json.loads(r.stdout); wrote = []
    sub['shots'] = out['subshots']
    if dump(sp, sub, indent=None): wrote.append('shots/13-subshots.json')
    for p in [CUT] + ([f] if f else []):
        if not os.path.exists(p): continue
        d = load(p)
        for s in (d['shots'] if 'shots' in d else [d]):
            if s.get('id') != cid: continue
            s['subshots'] = copy.deepcopy(out['film']['subshots']); s['presets'] = list(out['film']['presets'])
        if dump(p, d): wrote.append(os.path.relpath(p, H))
    return wrote


def run_pass():
    for n, cid, f in chapters():
        p = director_file(cid)
        if os.path.exists(p) and load(p).get('lighting'):
            w = apply_lighting(cid, f, load(p)['lighting'])
            print(f'ch{n:02d} {cid}: Director lighting ({", ".join(sorted(load(p)["lighting"]))}) -> {", ".join(w) or "no change"}')
        if os.path.exists(p) and 'props' in load(p):
            w = apply_props(cid, f, load(p)['props'])
            print(f'ch{n:02d} {cid}: Director props ({len(load(p)["props"])}) -> {", ".join(w) or "no change"}')
        if os.path.exists(p) and 'branding' in load(p):
            w = apply_branding(cid, f, load(p)['branding'])
            print(f'ch{n:02d} {cid}: Director branding -> {", ".join(w) or "no change"}')
        if os.path.exists(p) and 'desks' in load(p):
            w = apply_desks(cid, f, load(p)['desks'])
            print(f'ch{n:02d} {cid}: Director desks ({len(clean_desks(load(p)["desks"]))}) -> {", ".join(w) or "no change"}')
    for n, cid, f in chapters():
        p = director_file(cid)
        if os.path.exists(p) and 'build' in load(p):
            w = apply_featured_build(cid, f, clean_build(load(p)['build']))
            print(f'ch{n:02d} {cid}: Director featured desk build -> {", ".join(w) or "no change"}')
    for n, cid, f in chapters():
        p = director_file(cid)
        if os.path.exists(p) and clean_versions(load(p).get('versions')):
            w = apply_versions(cid, f, clean_versions(load(p)['versions']))
            print(f'ch{n:02d} {cid}: Director desk versions -> {", ".join(w) or "no change"}')
    for n, cid, f in chapters():
        if cid == 'awaken': continue
        p = director_file(cid)
        if not os.path.exists(p): continue
        dc = load(p); lines = []
        wrote = apply(n, cid, f, dc, lines.append)
        print(f'ch{n:02d} {cid}: {len(dc["keys"])} camera keys, {len(dc.get("clips") or [])} clips, {dc["seconds"]:g} s from '
              f'{os.path.basename(p)} -> {", ".join(wrote) or "no change"}')
        for l in lines: print(l)


def page_names(n, cid, downloads):
    page = 'director-ch01.html' if cid == 'awaken' else f'director-ch{n:02d}-{cid}.html'
    return os.path.join(H, page), os.path.join(downloads, f'ErgoFlex-film-ch{n:02d}-{cid}-director.json')


def local_clip(src):
    """A monitor clip that exists on this machine (the hq14 recaptures live on the Win render box): the clip, the
    20261030 clip of the same name, or chapter 1's 20261030 01-main; None if there is none."""
    alts = [src, src.replace('cinematic-intro-20261104-hq14', 'cinematic-intro-20261030'),
            re.sub(r'/01-[a-z]+\.mp4$', '/01-main.mp4', src.replace('cinematic-intro-20261104-hq14', 'cinematic-intro-20261030'))]
    return next((a for a in alts if os.path.isfile(os.path.join(root, a))), None)


def film_list(rows):
    """HQ28 (Vico: the Director showed the app's default props, not the film's; no way to step between chapters):
    <hq>/director-film/<id>.json is each chapter's FULL built film shot (what the renderer gets; chapter 1 is
    previews/awaken-v5-cut.json's), with its monitor clips pointed at copies on this machine, and
    <hq>/director-chapters.json lists the chapters. Each chapter page links /experience/#cut=..&film=<list>&director=1:
    the Director applies the film shot's setup to its live stage, shows a chapter picker and opens itself."""
    os.makedirs(os.path.join(H, 'director-film'), exist_ok=True)
    full = {s['id']: s for s in load(CUT)['shots']}
    v5 = os.path.join(H, 'previews', 'awaken-v5-cut.json')
    if os.path.exists(v5): full['awaken'] = load(v5)['shots'][0]
    base, items = '/' + os.path.relpath(os.path.abspath(H), root).strip('/'), []
    cl = os.path.join(H, 'director-chapters.json')
    before = {c.get('id'): c for c in load(cl).get('chapters', [])} if os.path.exists(cl) else {}
    for n, cid, page, js, src, cs, mine in rows:
        shot = json.loads(json.dumps(full[cid]))
        screens = []
        for sc in shot.get('screens') or []:
            c = local_clip(sc.get('src', ''))
            if c: screens.append(dict(sc, src=c))
        if 'screens' in shot: shot['screens'] = screens
        dump(os.path.join(H, 'director-film', f'{cid}.json'), shot)
        # Chapters the film renders as sub-shots (hero: shots/13-subshots.json, one desk build each): the Director's
        # Desk versions lane and live stage use them (experience/desk-versions.mjs), clips local like the shot's.
        sp = os.path.join(H, 'shots', '13-subshots.json')
        if shot.get('subshots') and cid == 'hero' and os.path.exists(sp):
            subs = []
            for x in load(sp)['shots']:
                x = json.loads(json.dumps(x))
                if 'screens' in x: x['screens'] = [dict(sc, src=c) for sc in x['screens'] for c in [local_clip(sc.get('src', ''))] if c]
                subs.append(x)
            # The finale renders with --storage post/finale-seed.json (render-finale.sh): its saved builds are the
            # presets' desks, so the Director's stage takes them too (in its memory-only storage).
            seed = os.path.join(H, 'post', 'finale-seed.json')
            dump(os.path.join(H, 'director-film', f'{cid}-subshots.json'), {'name': load(sp).get('name', ''), 'shots': subs,
                 **({'storage': f'{base}/post/finale-seed.json'} if os.path.exists(seed) else {})}, indent=None)
        items.append({'n': n, 'id': cid, 'title': src.get('title', ''), 'seconds': float(src['seconds']),
                      'page': f'{base}/{page}', 'shot': f'{base}/director-film/{cid}.json'})
        pf = os.path.join(H, page); h = open(pf).read()
        version, updated, h = stamp_page(h, before.get(cid, {}))
        items[-1].update(version=version, updated=updated)
        h2 = re.sub(r'(location\.replace\("/experience/#cut=[A-Za-z0-9+/=_%-]+)(?:&film=[^"&]*)?(?:&director=1)?"\)',
                    lambda m: m.group(1) + f'&film={base}/director-chapters.json&director=1")', h)
        if h2 != open(pf).read(): open(pf, 'w').write(h2)
    dump(os.path.join(H, 'director-chapters.json'), {'chapters': items})


def stamp_page(h, prev):
    """Reload fix (a reloaded Director tab kept the cut its URL hash was opened with, and its next Export cut sent those
    stale values back): every chapter page's cut carries 'filmVersion' (a hash of the cut without the stamp) and
    'filmUpdated' (UTC time that version was first built here, kept while the cut is unchanged; 'version' is the cut
    schema's), and director-chapters.json lists both per chapter as 'version' / 'updated'. On load the Director compares the hash's stamp with the list's and takes the page's newer cut."""
    m = re.search(r'#cut=([A-Za-z0-9_-]+)', h)
    if not m: return '', '', h
    cut = json.loads(base64.urlsafe_b64decode(m.group(1) + '=' * (-len(m.group(1)) % 4)))
    cut.pop('filmVersion', None); cut.pop('filmUpdated', None)
    version = hashlib.sha1(json.dumps(cut, sort_keys=True, separators=(',', ':')).encode()).hexdigest()[:12]
    updated = prev.get('updated') if prev.get('version') == version and prev.get('updated') else time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    cut['filmVersion'], cut['filmUpdated'] = version, updated
    enc = base64.urlsafe_b64encode(json.dumps(cut, separators=(',', ':')).encode()).decode().rstrip('=')
    return version, updated, h[:m.start(1)] + enc + h[m.end(1):]


def run_pages(ids, downloads):
    rows = []
    for n, cid, f in chapters():
        page, js = page_names(n, cid, downloads)
        if not ids or cid in ids:
            cmd = ['python3', BRIDGE, 'link', plan_source(cid, f), '--html', page, '--json', js] + ([] if f else ['--shot', cid])
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL)
        src = load(f) if f else next(s for s in load(CUT)['shots'] if s['id'] == cid)
        cs = next(s for s in load(CUT)['shots'] if s['id'] == cid)
        rows.append((n, cid, os.path.basename(page), os.path.basename(js), src, cs, os.path.exists(director_file(cid))))
    if not ids: print(f'{len(rows)} director pages and import files ({downloads})')
    film_list(rows)
    li = []
    for n, cid, page, js, src, cs, mine in rows:
        T, cT = float(src['seconds']), float(cs['seconds'])
        trim = f'; the film uses the first {cT:g} s' if cT < T - 1e-6 else ''
        li.append(f'<li><a href="{html.escape(page)}" target="ergoflex-director" onclick="mark(this)">Chapter {n}: {html.escape(cid)}</a> <small>{T:g} s, '
                  f'{len(src["cameraPlan"]["keys"])} camera keys, {len((src.get("motion") or {}).get("clips") or [])} desk moves{trim}'
                  f'{"; your Director edit is in" if mine else ""} &middot; import file {html.escape(js)}</small></li>')
    open(os.path.join(H, 'director-index.html'), 'w').write(
        '<!doctype html><meta charset="utf-8"><title>ErgoFlex film: Director Mode chapters</title>\n'
        '<script>if(location.hostname==="localhost")location.hostname="127.0.0.1"</script>\n'
        '<style>body{font:16px/1.6 system-ui,sans-serif;margin:2em;max-width:60em}small{color:#666}a.on{font-weight:700}a.on::after{content:"  \\2190  open"}</style>\n'
        # Vico (HQ26): no way to step to the next chapter inside Director Mode. Every chapter link opens in ONE named
        # Director tab ("ergoflex-director"), replacing the chapter before it, so this list is the chapter switcher and
        # tabs never pile up (each Director tab holds two of Chrome's six :3000 connections: the 'Preparing' trap).
        '<script>function mark(a){document.querySelectorAll("a.on").forEach(x=>x.classList.remove("on"));a.classList.add("on")}</script>\n'
        '<h1>ErgoFlex film: Director Mode chapters</h1>\n'
        '<p>Open a chapter, tune the camera keys and desk moves, then <b>Export cut</b>: the film picks the export up '
        'from Downloads. If a page does not open the cut, use Director Mode\'s <b>Import cut</b> with the chapter\'s '
        'import file in Downloads.</p>\n<ol>\n' + '\n'.join(li) + '\n</ol>\n')


TITLE_TEXT = (('eyebrow', 60), ('title', 140), ('detail', 260))


def clean_shadow(v):
    """Director Mode's title shadow: {blur?, opacity?, paths?: [{line?, points: [{x, y, in?, out?, smooth?}]}]} (film-titles.mjs)."""
    if not isinstance(v, dict): return None
    out, num = {}, lambda x, lo, hi: max(lo, min(hi, round(float(x), 3)))
    if 'blur' in v: out['blur'] = num(v['blur'], 0, 80)
    if 'opacity' in v: out['opacity'] = num(v['opacity'], 0, 1)
    paths = []
    for p in v.get('paths') or []:
        pts = []
        for q in (p.get('points') or [])[:96]:
            e = {'x': num(q['x'], -4000, 4000), 'y': num(q['y'], -4000, 4000)}
            for k in ('in', 'out'):
                if isinstance(q.get(k), list) and len(q[k]) == 2: e[k] = [num(q[k][0], -4000, 4000), num(q[k][1], -4000, 4000)]
            if q.get('smooth') and ('in' in e or 'out' in e): e['smooth'] = True
            pts.append(e)
        if len(pts) >= 3: paths.append(({'line': p['line']} if p.get('line') in ('eyebrow', 'title', 'detail') else {}) | {'points': pts})
    if paths: out['paths'] = paths
    return out or None


def import_titles(cid, titles, seconds, log):
    """The export's filmTitles -> the chapter's entries in titles-src.json (ids <chapter>-<n>: its n-th title there)."""
    p = os.path.join(H, 'titles-src.json'); src = load(p)
    old_idx = [i for i, t in enumerate(src['titles']) if t.get('chapter') == cid]
    mine = {f'{cid}-{n}': src['titles'][i] for n, i in enumerate(old_idx)}
    new, was = [], []
    for d in sorted(titles, key=lambda t: float(t['rel_in'])):
        e = copy.deepcopy(mine.get(d.get('id'), {'chapter': cid})); e['chapter'] = cid
        a, b = round(float(d['rel_in']), 3), round(float(d['rel_out']), 3)
        if not (0 <= a < b <= seconds + 1e-6): sys.exit(f'{cid}: title {d.get("title")!r} {a}-{b} s lies outside the {seconds:g} s chapter')
        e['rel_in'], e['rel_out'] = a, b
        for k, n in TITLE_TEXT: e[k] = str(d.get(k) or '')[:n]
        sh = clean_shadow(d.get('shadow'))
        if sh: e['shadow'] = sh
        else: e.pop('shadow', None)
        if d.get('timed'): e['director_timing'] = True
        else: e.pop('director_timing', None)
        new.append(e); was.append(mine.get(d.get('id'), {}))
    if [src['titles'][i] for i in old_idx] == new: return []
    at = old_idx[0] if old_idx else len(src['titles'])
    rest = [t for t in src['titles'] if t.get('chapter') != cid]
    at = sum(1 for i, t in enumerate(src['titles']) if i < at and t.get('chapter') != cid)
    tag = f'director-{cid}-{time.strftime("%Y%m%d-%H%M%S")}'
    open(os.path.join(H, f'titles-src.pre-{tag}.json'), 'w', encoding='utf-8').write(open(p, encoding='utf-8').read())
    src['titles'] = rest[:at] + new + rest[at:]
    json.dump(src, open(p, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    gone = len(old_idx) - sum(1 for o in was if o)
    if gone > 0: log(f'    {gone} title(s) of {cid} no longer in the export: removed')
    for e, old in zip(new, was):
        what = [k for k in ('rel_in', 'rel_out', 'eyebrow', 'title', 'detail', 'shadow') if old.get(k) != e.get(k)]
        log(f'    title {e["rel_in"]:g}-{e["rel_out"]:g} s {e["title"]!r}: {", ".join(what) or "unchanged"}{" (timing set in Director)" if e.get("director_timing") else ""}')
    return [f'titles-src.json (backup titles-src.pre-{tag}.json)']


def run_import(export):
    d = load(export); cid = (d.get('shots') or [{}])[0].get('id')
    known = {c: (n, f) for n, c, f in chapters()}
    if cid not in known:
        name = os.path.basename(export)
        cid = next((c for c in sorted(known, key=len, reverse=True) if name.startswith(f'Film-chapter-{c}')), None)
    if cid not in known: sys.exit(f'{export}: not a film chapter')
    n, f = known[cid]
    before = load(director_file(cid)) if os.path.exists(director_file(cid)) else {}
    cmd = ['python3', BRIDGE, 'import', export, director_file(cid), '--shot', cid, '--plan', plan_source(cid, f)]
    subprocess.run(cmd, check=True, stdout=sys.stderr)
    # The Lighting lane's edits ride in the export's shot; keep them beside the camera keys and clips (run_pass applies them).
    shot = (d.get('shots') or [{}])[0]
    lighting = {k: shot[k] for k in LIGHT_FIELDS if k in shot}
    if isinstance(lighting.get('timeOfDay'), list) and len(lighting['timeOfDay']) >= 2:
        tod = lighting['timeOfDay']
        if tod[0].get('at') == 0 and tod[0].get('mode') == 'night' and tod[1].get('at') == 0 and tod[1].get('mode') != 'night':
            lighting['timeOfDay'] = tod[1:]
    for k in GLOBAL_FIELDS:
        if k in (shot.get('sceneGlobals') or {}): lighting[k] = shot['sceneGlobals'][k]
    dc = load(director_file(cid))
    # Starting position (Chapter tab): the export's motion.initial height / tilt; an export without motion keeps the earlier import's.
    start = (shot.get('motion') or {}).get('initial')
    if isinstance(start, dict) and any(k in start for k in ('height', 'tilt')): dc['initial'] = {k: start[k] for k in ('height', 'tilt') if k in start}
    elif 'initial' in before: dc['initial'] = before['initial']
    if lighting: dc['lighting'] = lighting
    else: dc.pop('lighting', None)
    # Props: the export's list ([] = he reset them all); an export without the field keeps the earlier import's.
    if isinstance(shot.get('propEdits'), list): dc['props'] = [{k: v for k, v in e.items() if k != 'director'} for e in clean_props(shot['propEdits'])]
    elif 'props' in before: dc['props'] = before['props']
    # Prop layers (Layers tab: named groups of props, with eye / lock): no film effect, the hide edits above carry it; kept for the Director only.
    if isinstance(shot.get('propLayers'), list): dc['propLayers'] = [l for l in shot['propLayers'] if isinstance(l, dict)][:60]
    elif 'propLayers' in before: dc['propLayers'] = before['propLayers']
    # Branding: the export's overlay (empty = he reset it); an export without the field keeps the earlier import's.
    if isinstance(shot.get('brandingEdits'), dict) and clean_branding(shot['brandingEdits']): dc['branding'] = clean_branding(shot['brandingEdits'])
    elif 'branding' in before: dc['branding'] = before['branding']
    # Desks (the room's other ErgoFlex desks): the export's list ([] = he reset them all); an export without the field keeps the earlier import's.
    if isinstance(shot.get('deskEdits'), list): dc['desks'] = clean_desks(shot['deskEdits'])
    elif 'desks' in before: dc['desks'] = before['desks']
    # Featured desk build (Build tab): the export's deskBuild ({} = he reset it); an export without the field keeps the earlier import's.
    if isinstance(shot.get('deskBuild'), dict):
        if clean_build(shot['deskBuild']): dc['build'] = clean_build(shot['deskBuild'])
        else: dc.pop('build', None)
    elif 'build' in before: dc['build'] = before['build']
    # Desk versions (chapter 12's Desk version panel and lane): the export's list; an export without it keeps the earlier import's.
    if 'deskVersions' in shot:
        if clean_versions(shot['deskVersions']): dc['versions'] = clean_versions(shot['deskVersions'])
        else: print(f'{cid}: Director desk versions ignored (not a valid list)', file=sys.stderr)
    elif 'versions' in before: dc['versions'] = before['versions']
    dump(director_file(cid), dc)
    if 'versions' in dc: print(f'{cid}: Director desk versions ({" ".join(v["n"] + "=" + v["preset"] for v in dc["versions"])}) kept in {os.path.basename(director_file(cid))}', file=sys.stderr)
    if 'build' in dc: print(f'{cid}: Director featured desk build kept in {os.path.basename(director_file(cid))}', file=sys.stderr)
    if 'branding' in dc: print(f'{cid}: Director branding -> {sum(len(v) for v in dc["branding"]["artwork"]["surfaces"].values())} graphic edit(s) kept in {os.path.basename(director_file(cid))}', file=sys.stderr)
    if 'desks' in dc: print(f'{cid}: Director desks -> {len(dc["desks"])} desk edit(s) kept in {os.path.basename(director_file(cid))}', file=sys.stderr)
    if 'props' in dc: print(f'{cid}: Director props -> {len(dc["props"])} prop edit(s) kept in {os.path.basename(director_file(cid))}', file=sys.stderr)
    if isinstance(shot.get('filmTitles'), list):
        lines = []; wrote = import_titles(cid, shot['filmTitles'], float(shot.get('seconds') or dc['seconds']), lines.append)
        print(f'{cid}: Director titles -> {", ".join(wrote) or "titles-src.json unchanged"}', file=sys.stderr)
        for l in lines: print(l, file=sys.stderr)
    print(cid)


if '--pages' in args:
    downloads = opt('--downloads', os.path.expanduser('~/Downloads')); args.remove('--pages'); run_pages(args, downloads)
elif '--import' in args:
    run_import(opt('--import'))
elif not args:
    run_pass()
else:
    sys.exit(__doc__)
