#!/usr/bin/env python3
"""Two cuts made from Vicos 3rd cut (session "v", Nov 25 2026), rebuilt from that cut every run:

    python3 tools/experience/build-v-cuts.py [polish] [directors] [--base exports/cinematic-intro-cut-vicos-3rd-cut] [--no-score]

  exports/cinematic-intro-cut-v-polish     "V polish cut": the 3rd cut's chapters, order, lengths, cameras, people and
      titles exactly as they are (every chapter's shot data stays byte-for-byte, so the render PC reuses its chapter
      renders); only the finish changes: per-chapter grade trims (grade.json) and the sound mix (score-mix.json).
  exports/cinematic-intro-cut-v-directors  "V directors cut": one day with the desk. The opener ends when the desk has
      woken and risen (20 s instead of 48.3), the rooms run morning to night (the workshop's fold-away, which ends in
      evening light, comes before the sensing interlude and the two night rooms), every title is rewritten in one voice
      on one type scale, the seams and the music follow the new order.

Each run copies the base cut's film data over the cut's own (cut.json stays), applies the changes below, runs the
Director pass and pages for the cut, and builds its EDL and score. Nothing outside the two cut folders is written.
"""
import copy, glob, json, os, re, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
args = sys.argv[1:]
BASE = args[args.index('--base') + 1] if '--base' in args else 'exports/cinematic-intro-cut-vicos-3rd-cut'
WANT = [a for a in args if a in ('polish', 'directors')] or ['polish', 'directors']
DATA = ('review-cut.json', 'titles-src.json', 'edl.json', 'score-pins.json', 'shots/*.json', 'previews/awaken-v5-cut.json',
        'director-camera.json', 'director-camera-*.json')


def J(p): return json.load(open(p, encoding='utf-8'))
def W(p, d, indent=1):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf-8', newline='\n').write(json.dumps(d, indent=indent, ensure_ascii=False) + '\n')
def run(*cmd): print('  $', ' '.join(os.path.relpath(c, ROOT) if os.path.isabs(c) else c for c in cmd)); subprocess.run(cmd, check=True, cwd=ROOT)


def fresh(cut):
    """The base cut's film data over the cut's own (backups stay with their cut); stale pages and the score go."""
    src, dst = os.path.join(ROOT, BASE), os.path.join(ROOT, cut)
    if not os.path.exists(os.path.join(dst, 'cut.json')): sys.exit(f'{cut}: no cut.json (make it once with film-cuts.py duplicate)')
    for pat in DATA:
        for f in glob.glob(os.path.join(dst, pat)): os.remove(f)
        for f in glob.glob(os.path.join(src, pat)):
            name = os.path.relpath(f, src)
            if re.search(r'\.(pre|vico|cine)[-.]', name): continue
            to = os.path.join(dst, name); os.makedirs(os.path.dirname(to), exist_ok=True); shutil.copy2(f, to)
    for f in glob.glob(os.path.join(dst, 'director-ch*.html')) + glob.glob(os.path.join(dst, 'director-film', '*.json')) + glob.glob(os.path.join(dst, 'director-import', '*.json')):
        os.remove(f)
    if os.path.isdir(os.path.join(src, 'screens')) and not os.path.isdir(os.path.join(dst, 'screens')):
        shutil.copytree(os.path.join(src, 'screens'), os.path.join(dst, 'screens'))
    return dst


# ---------------------------------------------------------------------------------------------------------------------
# the finish both cuts share
# ---------------------------------------------------------------------------------------------------------------------
# Per-chapter grade trims (finish-intro.py reads <dir>/grade.json; render-request.sh lays a cut's own over the master's).
# Measured on the 4K film of Nov 25 (req-20261125T155816, one frame a second): the daylit rooms sit at a mean luma of
# 0.31-0.41, but the media lab (0.21) and the gym (0.19) a stop under them with a third less colour; movie night has 41 %
# of its picture under 3 % luma and the game room 24 %; the workshop is the warmest room of the film (blue 0.13 under
# green) and still gets +0.03 of warmth. The trims bring those five toward the rest; every other chapter keeps the
# master's values.
GRADE = {
    'awaken': {'gamma': 1.08, 'bloom': 0.06},
    'rise': {'contrast': 1.04},
    'create': {'contrast': 1.05, 'saturation': 1.1, 'curves': '0/0 0.25/0.22 0.6/0.6 0.88/0.81 1/0.93', 'gamma': 0.96, 'temp': -0.015},
    'commons': {'contrast': 1.04, 'saturation': 1.04},
    'coast': {'temp': 0.03, 'gamma': 1.20, 'contrast': 1.08, 'saturation': 1.15},
    'oilers': {'contrast': 1.03},
    'wellness': {'temp': 0.04, 'curves': '0/0 0.5/0.5 0.85/0.83 1/0.94', 'gamma': 1.12, 'saturation': 1.12, 'contrast': 1.03},
    'awareness': {'gamma': 1.05, 'bloom': 0.1},
    'music': {'saturation': 0.95, 'contrast': 1.06, 'bloom': 0.1, 'gamma': 1.14},
    'media': {'temp': -0.02, 'gamma': 1.12, 'contrast': 1.02, 'bloom': 0.1},
    'storage': {'temp': 0.0, 'gamma': 1.04, 'saturation': 0.95, 'contrast': 1.03},
    'hero': {'gamma': 1.0, 'temp': 0, 'curves': '0/0 0.5/0.5 0.85/0.83 1/0.95', 'bloom': 0.04},
}
# The score's mix (build-cine-score.py reads <cut>/score-mix.json). Measured on the score of Nov 25: 4-10 kHz sits 22.8 dB
# and the air above 10 kHz 32.1 dB under the loudest band, with the master shelving the top down another 1.5 dB, and the
# desk's own movement sounds 23-40 dB under the music (not heard). A 2 dB top shelf and 1 dB of presence open the mix;
# the movement sounds come up 4 dB.
MIX = {'master_eq': [{'kind': 'high', 'hz': 6500, 'db': 2.0}, {'kind': 'bell', 'hz': 2600, 'db': 1.0, 'octaves': 1.0}],
       'sfx_db': {'default': -18.0, 'wheels': -21.0}}


def polish(cut):
    d = fresh(cut)
    W(os.path.join(d, 'grade.json'), GRADE); W(os.path.join(d, 'score-mix.json'), MIX)
    same = open(os.path.join(d, 'review-cut.json'), 'rb').read() == open(os.path.join(ROOT, BASE, 'review-cut.json'), 'rb').read()
    print(f'  {cut}: grade.json, score-mix.json; review-cut.json ' + ('identical to the base cut' if same else 'DIFFERS from the base cut'))
    return d


# ---------------------------------------------------------------------------------------------------------------------
# the directors cut
# ---------------------------------------------------------------------------------------------------------------------
ORDER = ['awaken', 'rise', 'create', 'commons', 'coast', 'oilers', 'wellness', 'storage', 'awareness', 'music', 'media', 'hero']
AWAKEN_T = 20.0          # the opener ends 2.1 s after the lift has topped out and the camera's hold at standing height ends
RAMP = (43.4, 44.8)      # the base opener's last light ramp (stage up to full for the hand-over to the home office) ...
RAMP_TO = (AWAKEN_T - 1.9, AWAKEN_T - 0.5)     # ... moved to the new end: done as the dissolve to the rise reaches its middle
# seam -> [length, shift, type] (edl.json transitions); seams the base cut has keep its choice
SEAMS = {('awaken', 'rise'): [0.8, -0.35], ('rise', 'create'): 0.8, ('create', 'commons'): [0.8, 0, 'smoothleft'], ('commons', 'coast'): 0.8,
         ('coast', 'oilers'): 1.5, ('oilers', 'wellness'): [0.8, 0, 'smoothleft'], ('wellness', 'storage'): 1.0,
         ('storage', 'awareness'): [0.8, 0, 'fadeblack'], ('awareness', 'music'): [0.8, 0, 'fadeblack'], ('music', 'media'): 1.0,
         ('media', 'hero'): 1.5}
# One type scale for every title (the base cut's sizes run 34-63 for the small line and 42-53 for the supporting line).
TYPE = {'eyebrow': {'size': 50, 'spacing': 3.2, 'dy': 22}, 'detail': {'size': 46, 'spacing': 1.2, 'dy': -20}}
# chapter -> [(eyebrow, title, supporting line)] in the order of that chapter's titles; None = that title is dropped.
# The small line says where we are, the headline what the desk does there, the supporting line how.
COPY = {
    'awaken': [('ERGOFLEX', 'Meet the workstation\nthat moves with you.', 'More comfort. Clearer focus. More joy in your work.'),
               ('DESIGNED FOR MOTION', 'Spend a day with it.', 'From the first coffee to movie night.'),
               None],
    'rise': [('HOME OFFICE', 'Your day. Your rhythm.', '50+ guided routines built right in.')],
    'create': [('ART STUDIO', 'Angle it to your art.', 'Digital, drafting and painting on one surface.')],
    'commons': [('CAMPUS LIBRARY', 'The desk that comes to you.', 'Shared space that adjusts to every body.')],
    'coast': [('MEDIA LAB', 'Ideas become stories.', 'Your own edit suite in a shared studio.')],
    'oilers': [('CLASSROOM', 'Room to discover.', 'Every learner at their own height.')],
    'wellness': [('GYM', 'Movement built\ninto your day.', 'Pause. Stretch. Breathe. Reset.')],
    'storage': [('WORKSHOP', 'Make room for what’s next.', 'One tap. It folds and rolls to the wall.')],
    'awareness': [('ALWAYS AWARE', 'It senses what’s in the way.', 'Proximity sensors stop the roll before contact.')],
    'music': [('GAME ROOM', 'Feel the room come alive.', 'Light that plays along with the game.')],
    'media': [('MOVIE NIGHT', 'The room joins the film.', 'Ambient color drawn from every scene.')],
    'hero': [('ONE DESK', 'Every part of your day.', 'Configured by you. Engineered to last.')],
}
# The music in the new order: the workshop is no longer the run-up to the finale (no clap roll, level stays), movie
# night is: it swells and rolls into the finale. Every room where the desk lifts or tilts lets that movement be heard.
MIX_DIRECTORS = {**MIX,
                 'styles': {'storage': {'roll': False, 'mixdb': [-0.5, 0.0]}, 'media': {'roll': True, 'mixdb': [-2.0, 0.0]}},
                 'sfx_rules': {'rise': ['lift-up', 'lift-down'], 'create': ['lift-up', 'tilt-retract'], 'coast': ['lift-up'],
                               'oilers': ['lift-down'], 'wellness': ['lift-up', 'lift-down']}}
# The day in the grade: the polish trims, with the afternoon rooms a touch warmer and the workshop's evening kept warm.
GRADE_DIRECTORS = {**copy.deepcopy(GRADE), 'storage': {'temp': 0.02, 'gamma': 1.04, 'saturation': 0.95, 'contrast': 1.03}}


def at(keys, t):
    """A keyed value [[t, v], ...] at t (linear, held outside)."""
    if t <= keys[0][0]: return keys[0][1]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t0 <= t <= t1: return v0 if t1 == t0 else v0 + (v1 - v0) * (t - t0) / (t1 - t0)
    return keys[-1][1]


def is_keyed(v): return isinstance(v, list) and len(v) > 1 and all(isinstance(k, list) and len(k) == 2 and all(isinstance(x, (int, float)) for x in k) for k in v)


def retime_keyed(v, T, log, path=''):
    """Every keyed value of the opener's look ([[t, v], ...] in chapter seconds) cut to the new length: one that takes part
    in the base cut's last ramp gets that ramp at the new end, any other only loses its keys after the end."""
    if is_keyed(v):
        ts = [k[0] for k in v]
        if max(ts) <= T: return v
        if RAMP[0] in ts and RAMP[1] in ts:
            out = [k for k in v if k[0] < RAMP_TO[0] - 1e-6] + [[RAMP_TO[0], at(v, RAMP[0])], [RAMP_TO[1], at(v, RAMP[1])]]
            if abs(at(v, RAMP_TO[0]) - at(v, RAMP[0])) > 1e-6: log.append(f'{path}: value at {RAMP_TO[0]} s was {at(v, RAMP_TO[0]):g}, the ramp starts from {at(v, RAMP[0]):g}')
        else:
            out = [k for k in v if k[0] <= T] + [[T, at(v, T)]]
            log.append(f'{path}: keys after {T} s dropped, held at {at(v, T):g}')
        return out
    if isinstance(v, dict): return {k: retime_keyed(x, T, log, f'{path}.{k}') for k, x in v.items()}
    if isinstance(v, list): return [retime_keyed(x, T, log, f'{path}[{i}]') for i, x in enumerate(v)]
    return v


def view_at(shot, t):
    """The baked camera's view at chapter second t (its keys: time as a fraction of the chapter)."""
    ks, T = shot['camera']['keys'], float(shot['seconds']); f = t / T
    for a, b in zip(ks, ks[1:]):
        if a['time'] <= f <= b['time']:
            u = 0 if b['time'] == a['time'] else (f - a['time']) / (b['time'] - a['time'])
            mix = lambda p, q: [x + (y - x) * u for x, y in zip(p, q)]
            return mix(a['view']['position'], b['view']['position']), mix(a['view']['target'], b['view']['target']), a['view']['fov'] + (b['view']['fov'] - a['view']['fov']) * u
    raise SystemExit(f'no camera at {t} s')


def directors(cut):
    d = fresh(cut); log = []
    cp = os.path.join(d, 'review-cut.json'); rc = J(cp)
    by = {s['id']: s for s in rc['shots']}
    if sorted(by) != sorted(ORDER): sys.exit(f'chapters changed in the base cut: {sorted(by)}')
    base_aw = copy.deepcopy(by['awaken']); T0 = float(base_aw['seconds'])
    if abs(T0 - 48.3) > 1e-6: sys.exit(f'the base opener is {T0} s, not the 48.3 s this trim was made for: check AWAKEN_T, RAMP')
    # 1. the opener's Director file cut to the new length: the pass (below) then retimes camera, moves and status lights
    dp = os.path.join(d, 'director-camera.json'); dc = J(dp)
    keys = [k for k in dc['keys'] if k['at'] < AWAKEN_T - 1e-6]
    pos, tgt, fov = view_at(base_aw, AWAKEN_T)
    keys.append({'at': AWAKEN_T, 'position': pos, 'target': tgt, 'fov': fov, 'label': 'Drifting off the hold into the dissolve'})
    gone = [c['id'] for c in dc['clips'] if c['start'] + c['duration'] > AWAKEN_T + 1e-6]
    dc['clips'] = [c for c in dc['clips'] if c['id'] not in gone]
    for tr in dc.get('tray') or []: tr['keys'] = [k for k in tr['keys'] if k['t'] <= AWAKEN_T]
    dc.update(seconds=AWAKEN_T, keys=keys); W(dp, dc)
    print(f'  opener: {T0:g} -> {AWAKEN_T:g} s, {len(keys)} camera keys, clips dropped: {len(gone)}')
    # 2. the opener's keyed look (stage light, rims, environment, grid) in the film shot and in the copy the film renders
    #    from; the moves, status lights and tray keys past the new end go here too (the pass keeps what the shot has)
    pv = os.path.join(d, 'previews', 'awaken-v5-cut.json'); pvd = J(pv)
    for s in (by['awaken'], pvd['shots'][0]):
        lg = [] if s is not by['awaken'] else log
        for f in ('lights', 'sceneEdits', 'sceneGlobals'): s[f] = retime_keyed(s[f], AWAKEN_T, lg, f)
        s['ledStatus'] = [dict(e, dur=round(min(e['dur'], AWAKEN_T - e['at']), 3)) for e in s['ledStatus'] if e['at'] < AWAKEN_T - 0.5]
        for tr in s.get('sceneTray') or []: tr['keys'] = [k for k in tr['keys'] if k['t'] <= AWAKEN_T]
    W(pv, pvd)
    # 3. the day's order
    rc['shots'] = [by[i] for i in ORDER]; rc['name'] = 'V directors cut'
    W(cp, rc)
    for l in log: print('   ', l)
    # 4. titles: one voice, one type scale; position, timing, scrim kept (the framing under them is unchanged)
    tp = os.path.join(d, 'titles-src.json'); src = J(tp); n = {}; out = []
    for t in src['titles']:
        i = n.get(t['chapter'], 0); n[t['chapter']] = i + 1
        new = COPY[t['chapter']][i]
        if new is None: continue
        t = dict(t); t['eyebrow'], t['title'], t['detail'] = new
        t['typography'] = copy.deepcopy(TYPE)
        if '\n' in t['title']: t['typography']['title'] = {'lineHeight': 1.2}
        if t['chapter'] == 'awaken' and i == 0: t['typography']['detail']['size'] = 43    # as wide as the base cut's block, which clears the desk
        t.pop('shadow', None)                                   # fitted line boxes: the base cut's hand-drawn ones fit its copy
        if float(t.get('scale', 1)) > 1: t.pop('scale')
        out.append(t)
    aw = [t for t in out if t['chapter'] == 'awaken']
    aw[1]['rel_out'] = 17.4                                     # the second opener title leaves 1.1 s before the dissolve starts
    for t in out:
        T = float(by[t['chapter']]['seconds']) if t['chapter'] != 'awaken' else AWAKEN_T
        if t['rel_out'] is not None and t['rel_out'] > T: sys.exit(f"title {t['title']!r} ends after its chapter")
    src['titles'] = out; W(tp, src)
    print(f'  titles: {len(out)} (one dropped with the opener\'s second half)')
    # 5. seams in the new order; the base cut's pinned bar lines belong to its timing
    ep = os.path.join(d, 'edl.json'); edl = J(ep)
    edl['transitions'] = [SEAMS[(a, b)] for a, b in zip(ORDER, ORDER[1:])]; W(ep, edl)
    # The base cut's pinned bar lines belong to its timing; one is kept in spirit: the finale's first bar line sits 1.05 s
    # into the finale, as in the base cut, so its desk-version fades (keyed onto that grid) land on bar lines here too.
    hero_start = round(sum(float(by[i]['seconds']) if i != 'awaken' else AWAKEN_T for i in ORDER[:-1]) - float(edl['dissolve']) * (len(ORDER) - 1), 3)
    W(os.path.join(d, 'score-pins.json'), {'note': 'V directors cut: the finale keeps the base cut\'s grid (first bar line 1.05 s in), so its desk changes stay on bar lines.',
                                           'bar_lines': [{'at': round(hero_start + 1.05, 3), 'why': 'media -> hero dissolve bar line, where the base cut has it relative to the finale'}]})
    W(os.path.join(d, 'grade.json'), GRADE_DIRECTORS); W(os.path.join(d, 'score-mix.json'), MIX_DIRECTORS)
    return d


def finish(cut, d, score=True):
    run(sys.executable, os.path.join(HERE, 'build-round8-director.py'), d)
    if score: run(sys.executable, os.path.join(HERE, 'build-cine-score.py'), d)
    else: run(sys.executable, os.path.join(HERE, 'build-cine-score.py'), d, '--edl-only')
    run(sys.executable, os.path.join(HERE, 'titles-after-cut.py'), d, '--dry')
    run(sys.executable, os.path.join(HERE, 'film-cuts.py'), 'pages', cut)


CUTS = {'polish': ('exports/cinematic-intro-cut-v-polish', polish), 'directors': ('exports/cinematic-intro-cut-v-directors', directors)}
for name in WANT:
    cut, fn = CUTS[name]; print(f'== {cut}')
    finish(cut, fn(cut), '--no-score' not in args)
