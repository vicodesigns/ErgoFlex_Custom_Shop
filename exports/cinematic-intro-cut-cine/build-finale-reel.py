#!/usr/bin/env python3
"""The finale (chapter 'hero') as a fast highlight reel, cut on the beat (stream S26, Nov 14 2026).

    python exports/cinematic-intro-cut-cine/build-finale-reel.py            # in place; running it twice changes nothing

Vico: "make it snappier ... boom, boom, boom ... a good highlight of all of them". Eight desks, each one shown dressed,
flat or at its signature angle, with hard cuts on the beat. The cuts come every bar, then every half bar, into the
red desk. The red desk holds under the closing title, the wordmark and "Let's build yours.".

Writes:
  shots/13-subshots.json   one sub-shot per desk (letters A..H in time order). renderRange = its block, plus one
                           frame of overlap, so join-subshots.py's xfade lasts one frame: a hard cut.
                           The look bundle per desk (kind, preset, lights, sceneEdits, screens, sceneGlobals, accessories)
                           is taken from the sub-shot that already shows that preset (S18's bundles). library and music
                           are new looks, built from the office (light) and hbhs (dark) bundles.
  review-cut.json          hero only: seconds, motion, cameraPlan + camera, sceneEdits tracks, subshots map, presets.
  titles-src.json          hero only: the closing title, logo and cta times (wording untouched).
One desk move and one camera are still shared by every sub-shot and the cut's hero (as the Director import expects):
  - motion: the desk jumps to the next desk's pose just after the cut frame (lift and tilt clips 0.005-0.025 s after
    it). join-subshots.py's one-frame xfade shows the outgoing sub-shot on the cut frame and the incoming one from
    the next frame on, so every desk is seen only at its own pose (the cut lands 1/30 s after the beat);
  - camera: one spline with a 'cut' key at every desk change (camera-spline.mjs). Each block pushes in from its
    own angle. The cut keys also put the cuts on beats in the score (build-cine-score.py reads cameraPlan cuts).
Timing is in beats of 60/112 s from the bar line at the centre of the dissolve from storage (0.75 s). Every
cut is rounded to a whole frame at 30 fps.
"""
import copy, json, math, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SUB, CUT, TITLES = (os.path.join(HERE, 'shots', '13-subshots.json'), os.path.join(HERE, 'review-cut.json'),
                    os.path.join(HERE, 'titles-src.json'))
SPLINE = os.path.join(ROOT, 'tools', 'experience', 'camera-spline.mjs')
FPS, BEAT, BAR0 = 30, 60 / 112, 0.75
FRAME = 1 / FPS
fr = lambda t: round(round(t * FPS) / FPS, 4)

# desk, preset, beats, pose (height in, tilt deg), camera (azimuth from the desk's front +x toward +z, elevation,
# distance at the cut -> at the end of the block, aim height, fov). Screens: (target, clip, clip second at the block start,
# or None: the clip runs on the chapter clock, offset 0, as build-screens.py writes the per-desk cine-hero-* clips;
# S15 re-captures them for these windows). The office clips and the oilers quiz are windowed: local clip time.
S = 'exports/cinematic-intro-cut-cine/screens/'
DESKS = [
    ('artist',    4, (52.5, 65), (48, 10, 8.0, 7.2, 1.45, 27), [('main-landscape', S + 'cine-hero-artist.mp4', None)]),
    ('office',    4, (46.0, 0),  (-30, 12, 7.8, 7.0, 1.40, 27), [('main-landscape', S + 'cine-hero-office-wide.mp4', 0.0),
                                                                ('main-portrait', S + 'cine-hero-office-portrait.mp4', 0.0)]),
    ('hbhs',      4, (40.0, 8),  (24, 4, 7.6, 6.9, 1.40, 27), [('main-landscape', S + 'cine-hero-hbhs.mp4', None),
                                                              ('main-portrait', S + 'cine-oilers-portrait.mp4', 1.7)]),
    ('occ',       2, (39.0, 0),  (-46, 15, 7.3, 6.9, 1.30, 27), [('main-landscape', S + 'cine-hero-occ.mp4', None)]),
    ('library',   2, (30.0, 0),  (40, 9, 7.2, 6.8, 1.15, 27), [('main-landscape', S + 'cine-commons-reservation.mp4', None)]),
    ('music',     2, (30.0, 0),  (-16, 10, 7.0, 6.6, 1.15, 27), [('main-landscape', 'app-reference/assets/desk_viewer/media/ambient-clip.mp4', 40.0)]),
    ('architect', 2, (28.0, 22), (14, 22, 8.7, 8.2, 1.15, 27), []),
    ('gaming',    None, (28.0, 0), None, [('main-landscape', S + 'cine-hero-gaming.mp4', None)]),
]
RED_TITLE_IN, RED_TITLE_LEN, LOGO_BEATS, CTA_BEATS, TAIL = 1, 3.0, 8, 3, 5.55     # beats after the red desk lands
EXPOSURE = {'library': .85, 'music': .95}
DARK_TOP = {'match': '^(Desktop|Top_Shelf)(_\\d+)?$', 'material': {'clearcoat': 0, 'specularIntensity': 0.05}}
BUNDLE = ['kind', 'preset', 'lights', 'sceneEdits', 'screens', 'sceneGlobals', 'accessories']
DESK_C = (-0.25, 0.5)            # desk centre on the floor (x, z), stage units; the front faces +x
END_KEY = dict(position=[8.395, 2.05, -4.021], target=[0.157, 0.54, 0.076], fov=28.5)   # the old end card framing


def timeline():
    t, out = 0.0, []
    beat = 0
    for d in DESKS[:-1]:
        beat += d[1]; out.append(fr(BAR0 + beat * BEAT))
    red = out[-1]
    logo = fr(red + LOGO_BEATS * BEAT)
    return out, red, logo


def look_of(subs, preset):
    src = next((s for s in subs if s.get('preset') == preset), None)
    if src: return {k: copy.deepcopy(src[k]) for k in BUNDLE if k in src}
    tmpl = next(s for s in subs if s.get('preset') == ('hbhs' if preset == 'music' else 'office'))
    b = {k: copy.deepcopy(tmpl[k]) for k in BUNDLE if k in tmpl}
    b['preset'] = preset; b['kind'] = 'hero'; b['accessories'] = {}
    b['sceneGlobals'] = dict(b['sceneGlobals'], exposure=EXPOSURE[preset])
    edits = [e for e in b['sceneEdits'] if e.get('match') != DARK_TOP['match']]
    b['sceneEdits'] = edits + ([copy.deepcopy(DARK_TOP)] if preset == 'music' else [])
    return b


def pos(az, el, dist, y):
    a, e = math.radians(az), math.radians(el)
    tx, tz = DESK_C
    return [round(tx + dist * math.cos(e) * math.cos(a), 4), round(y + dist * math.sin(e), 4), round(tz + dist * math.cos(e) * math.sin(a), 4)]


def cam_keys(starts, ends, red, logo, T):
    keys = []
    for i, d in enumerate(DESKS[:-1]):
        az, el, d0, d1, y, fov = d[3]; t0, t1 = starts[i], ends[i]
        tgt = [DESK_C[0], y, DESK_C[1]]
        k0 = dict(at=t0, position=pos(az, el, d0, y), target=tgt, fov=fov, label=f'{d[0]}: cut in')
        if i: k0['cut'] = True
        keys += [k0, dict(at=round(t1 - 0.04, 4), position=pos(az + 3, el, d1, y), target=tgt, fov=fov, label=f'{d[0]}: push')]
    # the red desk: lands three-quarter front-right, eases round and back to the end card framing by the wordmark
    # under the closing title (lower left) the desk stands right of centre (frame_right), clear of the headline
    land = frame_right(dict(at=red, position=pos(42, 8, 7.0, 1.05), target=[DESK_C[0], 1.05, DESK_C[1]], fov=27, cut=True, label='red desk lands'), 0.14)
    keys += [land,
             frame_right(dict(at=round((red + logo) / 2, 4), position=pos(10, 9, 8.2, 0.8), target=[-0.05, 0.75, 0.3], fov=27.8, label='red desk: round to the front'), 0.12),
             dict(at=logo, **copy.deepcopy(END_KEY), label='end card: desk at rest, frontal 3/4'),
             dict(at=T, position=[8.6, 2.04, -4.15], target=[0.157, 0.54, 0.076], fov=28.5, label='end')]
    return keys


def frame_right(k, dx):
    """build-cine-cut.py's frame_right: the aim turned left about the vertical so the subject sits dx of the width right."""
    k = dict(k); p, t = k['position'], k['target']
    h = 2 * math.atan(math.tan(math.radians(k['fov']) / 2) * 16 / 9)
    a = math.atan(2 * dx * math.tan(h / 2)); vx, vz = t[0] - p[0], t[2] - p[2]; c, s = math.cos(a), math.sin(a)
    k['target'] = [round(p[0] + vx * c + vz * s, 4), t[1], round(p[2] - vx * s + vz * c, 4)]
    return k


def spline(seconds, plan):
    fd, name = tempfile.mkstemp(suffix='.json'); os.close(fd)
    with open(name, 'w', newline='\n') as f: json.dump({'seconds': seconds, 'cameraPlan': plan}, f)
    subprocess.run(['node', SPLINE, name], check=True, stdout=subprocess.DEVNULL)
    with open(name, encoding='utf-8') as f: cam = json.load(f)['camera']
    os.unlink(name); return cam


def pose_clips(starts):
    """Jump to the next desk's pose just after each cut frame (the shared desk move)."""
    clips, prev = [], DESKS[0][2]
    for i, d in enumerate(DESKS[1:]):
        t = starts[i + 1]
        for lane, j in (('lift', 0), ('tilt', 1)):
            if d[2][j] == prev[j]: continue
            clips.append({'id': f'{chr(66 + i).lower()}-{lane}', 'lane': lane, 'kind': lane, 'start': round(t + 0.005, 4), 'duration': 0.02,
                          'easing': 'linear', 'label': '', 'target': d[2][j],
                          'path': [{'time': 0, 'pose': {('height' if lane == 'lift' else 'tilt'): prev[j]}},
                                   {'time': 1, 'pose': {('height' if lane == 'lift' else 'tilt'): d[2][j]}}]})
        prev = d[2]
    return {'version': 2, 'initial': {'height': DESKS[0][2][0], 'tilt': DESKS[0][2][1], 'x': 0, 'z': 0, 'yaw': 0}, 'clips': clips}


def key_light(lights, t0, red):
    """The light hits with the cut: the key rises on the cut and settles in 0.35 s (0.8 s and higher on the red desk)."""
    lights = copy.deepcopy(lights)
    peak, settle = (60, 0.8) if t0 == red else (42, 0.35)
    track = [[0, 30]] + ([[round(t0, 4), peak], [round(t0 + settle, 4), 30]] if t0 > 0 else [])
    lights[0]['key']['intensity'] = track
    return lights


def main():
    load = lambda p: json.loads(open(p, 'rb').read().replace(b'\r\n', b'\n'))
    sub, cut, titles = load(SUB), load(CUT), load(TITLES)
    cuts, red, logo = timeline()
    T = fr(logo + TAIL)
    starts = [0.0] + cuts; ends = cuts + [T]
    plan_keys = cam_keys(starts, ends, red, logo, T)
    hero = next(s for s in cut['shots'] if s['id'] == 'hero')
    plan = {'easeIn': False, 'easeOut': True, 'keys': plan_keys}
    camera = spline(T, plan)
    motion = pose_clips(starts)
    grid = [{'match': '@grid', 'opacity': [[0, 0.35], [red, 0.25], [fr(logo - 0.6), 0]], 'radialFade': [3, 8]},
            {'match': '@pulse', 'opacity': [[0, 1], [red, 0.6], [fr(logo - 0.6), 0]]}]
    old = sub['shots']
    out = []
    for i, d in enumerate(DESKS):
        preset, screens = d[0], d[4]
        b = look_of(old, preset)
        base = copy.deepcopy(old[0])
        s = {k: base[k] for k in base if k not in BUNDLE}
        s.update(b)
        s['seconds'] = T; s['motion'] = copy.deepcopy(motion); s['cameraPlan'] = copy.deepcopy(plan); s['camera'] = copy.deepcopy(camera)
        s['subshot'] = chr(65 + i)
        t0, t1 = starts[i], ends[i]
        s['renderRange'] = [t0, T if i == len(DESKS) - 1 else round(t1 + FRAME, 4)]
        s['lights'] = key_light(b['lights'], t0, red)
        s['sceneEdits'] = grid + [e for e in b['sceneEdits'] if e.get('match') not in ('@grid', '@pulse')]
        s['screens'] = [{'target': tg, 'src': src, 'offset': 0 if at is None else round(at - t0, 4), 'loop': False} for tg, src, at in screens]
        if preset == 'gaming': s['ledGlow'] = 0.35
        out.append(s)
    sub['name'] = 'Finale highlight reel (S26): one desk per beat block, hard cuts'
    sub['shots'] = out
    hero.update(seconds=T, motion=copy.deepcopy(motion), cameraPlan=copy.deepcopy(plan), camera=copy.deepcopy(camera))
    hero['sceneEdits'] = grid + [e for e in hero['sceneEdits'] if e.get('match') not in ('@grid', '@pulse')]
    hero['subshots'] = {s['subshot']: s['renderRange'] for s in out}
    hero['presets'] = [s['preset'] for s in out]
    hero['lights'] = copy.deepcopy(out[-1]['lights'])
    t = next(x for x in titles['titles'] if x['chapter'] == 'hero')
    t['rel_in'] = fr(red + RED_TITLE_IN * BEAT); t['rel_out'] = fr(t['rel_in'] + RED_TITLE_LEN)
    titles['logo']['rel_in'] = logo
    titles['cta']['rel_in'] = fr(logo + CTA_BEATS * BEAT)
    for p, d, kw in ((SUB, sub, {}), (CUT, cut, {'indent': 1}), (TITLES, titles, {'indent': 1})):
        b = json.dumps(d, **kw).encode()
        if b != open(p, 'rb').read().replace(b'\r\n', b'\n'): open(p, 'wb').write(b)
    rows = [(s['subshot'], s['preset'], starts[i], ends[i], round((ends[i] - starts[i]) / BEAT, 2)) for i, s in enumerate(out)]
    for r in rows: print('%s %-9s %6.3f - %6.3f  %5.2f beats' % r)
    print('closing title %.3f-%.3f, logo %.3f, cta %.3f, hero %.3f s' % (t['rel_in'], t['rel_out'], logo, titles['cta']['rel_in'], T))


if __name__ == '__main__':
    main()
