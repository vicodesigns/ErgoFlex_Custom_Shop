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
      End card (hero): an export whose shot has 'endCard' ({logo?: {rel_in, x, y, scale}, cta?: {rel_in, rel_out, text, fade_in,
      size, font, spacing, gap, x}}: the Titles lane's wordmark / CTA blocks, only the parts he changed) rewrites titles-src.json's
      'logo' / 'cta' (same backup), each changed part marked edited: true so polish1124-hero3/apply.py leaves it alone. Moving
      the wordmark's rel_in moves the score's logo hit: build-cine-score.py <cut> re-fits it (its --check says when it is due).
      Desk versions (hero): an export whose shot has 'deskVersions' ([{n, preset, name, start, end}] in time order: the
      chapter's desks, one sub-shot each: its id, desk model, label and renderRange) keeps them in director-camera-hero.json
      as 'versions' (an export without the field keeps the earlier import's). The list is the whole chapter: 1 to 12
      versions; ids the film does not have yet ('G', 'H', ...) are versions added in the Director (copies of their model's
      sub-shot), film ids missing from it are versions he removed. The pass rewrites shots/13-subshots.json (one sub-shot per
      version: preset, renderRange, name and the model's dressing) and the film shot's subshots map + presets
      (tools/experience/desk-versions-apply.mjs). The bundle of a film sub-shot whose model the list no longer shows is kept
      in director-camera-hero.json as 'versionLibrary' (and offered to the Director in director-film/hero-subshots.json as
      'library'), so the model gets the film's dressing back when a later list shows it again.
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
      Screen look: an export whose shot has 'screenLook' (Director Mode's Graphics tab: the screens' strength, contrast,
      black level, saturation, colour temperature, glare and glow spill, for all screens and per screen,
      experience/screen-look.mjs) keeps it in director-camera-<id>.json as 'screenLook' ({} = he reset it; an export
      without the field keeps the look imported before). The pass writes it onto the chapter's film shot as 'screenLook'
      (an empty look removes it); render-cut passes it to film-fx.
      Sonar: an export whose shot has 'sonar' (Director Mode's Graphics tab, a proximity chapter's: on / off, size, rings per
      pulse and the centre's offset, experience/sonar.mjs) keeps it in director-camera-<id>.json as 'sonar' ({} = he put it back
      to the film's; an export without the field keeps the one imported before). The pass writes it onto the chapter's film shot
      as 'sonar' (an empty one removes it); stage.mjs reads it from the shot, render-cut / render-still pass the shot whole.
      Desks: an export whose shot has 'deskEdits' (Director Mode's Desks: size, place and starting height / tilt of the
      room's other ErgoFlex desks, experience/desk-edits.mjs; later per-desk moves and builds) keeps them in
      director-camera-<id>.json as 'desks' (an export without the field keeps the earlier import's). The pass writes them
      onto the chapter's film shot as 'sceneDeskEdits' (tools/experience/film-desk-edits.mjs installs them).
      Keyboard tray: an export whose shot has 'trayEdits' (Director Mode's Tray lane: the articulated tray's keys, experience/tray-pose.mjs;
      slide / swing / baseTilt / tilt poses by chapter second; an old export's bracket / drop are ignored) keeps them in director-camera-<id>.json as 'tray' ([] = he took them all
      off; an export without the field keeps the earlier import's). The pass writes them onto the chapter's film shot (review-cut.json,
      the chapter's shot file, hero's sub-shots) as 'sceneTray', which film-fx.mjs plays with the same sampler as the live stage;
      none removes the field. Only a chapter with tray keys gets the field, so every other chapter's key (chapter-keys.py) is unchanged.
      Room look: an export whose shot has 'look' (Director Mode's Room look: a version of the chapter's room, room-looks.mjs)
      keeps it in director-camera-<id>.json as 'look' (an export without the field keeps the earlier import's). The pass
      writes it onto the chapter's film shot (review-cut.json, the chapter's shot file, hero's sub-shots) as 'look', which
      stage.mjs builds; chapter-keys.py hashes the whole shot, so a set look is part of that chapter's key only.
"""
import base64, copy, glob, hashlib, html, json, math, os, re, subprocess, sys, tempfile, time

_open = open
def open(file, mode='r', *a, **k):
    """UTF-8 and LF whatever the platform (Windows' default code page garbled the cut's labels: S31)."""
    if 'b' not in mode:
        k.setdefault('encoding', 'utf-8')
        if 'w' in mode or 'a' in mode: k.setdefault('newline', chr(10))
    return _open(file, mode, *a, **k)
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
    with open(p, 'w', newline=chr(10)) as f: json.dump(d, f, indent=indent)      # (LF on Windows too: the cut's own format)
    return True


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


def same_value(a, b):
    """Equal as JSON, numbers within 1e-4 (the Director rounds clip times to 4 decimals)."""
    if isinstance(a, bool) or isinstance(b, bool): return a == b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)): return abs(a - b) <= 1e-4
    if isinstance(a, list) and isinstance(b, list): return len(a) == len(b) and all(same_value(x, y) for x, y in zip(a, b))
    if isinstance(a, dict) and isinstance(b, dict): return a.keys() == b.keys() and all(same_value(a[k], b[k]) for k in a)
    return a == b


def clip_same(d, mine):
    """The Director's clip d says what the film's clip says (its label: the Director keeps the first 60 characters)."""
    return all((isinstance(v, str) and isinstance(mine.get(k), str) and mine[k].startswith(v)) if k == 'label' else same_value(v, mine.get(k)) for k, v in d.items() if k in CLIP_FIELDS)


def merge_clips(old, new):
    """S31: a clip the Director did not change (every field it sends equal to the film's, within its rounding) stays the
    film's clip as it is; when none changed and none was added or deleted, the film's list comes back untouched."""
    mine = {c['id']: c for c in old}
    if len(new) == len(old) and all(d.get('id') in mine and clip_same(d, mine[d['id']]) for d in new):
        return copy.deepcopy(old)
    out = []
    for d in sorted(new, key=lambda c: (c['start'], c.get('lane', ''))):
        if d.get('id') in mine and clip_same(d, mine[d['id']]): out.append(copy.deepcopy(mine[d['id']])); continue
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
    """The Chapter tab's Starting position (Director's motion.initial height / tilt, and the wheels start x / z / yaw
    where the import has them: only those he changed from the film's) over the film's start pose. Clips are untouched:
    each still runs from the pose before it to its target."""
    out = dict(initial)
    for k, lo, hi in (('height', 28, 52.5), ('tilt', -5, 65), ('x', -240, 240), ('z', -240, 240), ('yaw', -3600, 3600)):
        v = mine.get(k)
        if isinstance(v, (int, float)) and not isinstance(v, bool): out[k] = round(min(hi, max(lo, float(v))), 3)
    for k in ('height', 'tilt', 'x', 'z', 'yaw'):
        if isinstance(out.get(k), float) and out[k] == int(out[k]): out[k] = int(out[k])
    if (out.get('height'), out.get('tilt')) != (initial.get('height'), initial.get('tilt')):
        log(f'    starting position {initial.get("height")}" / {initial.get("tilt")} deg -> {out["height"]}" / {out["tilt"]} deg')
    for k in ('x', 'z', 'yaw'):
        if out.get(k, 0) != initial.get(k, 0): log(f'    starting {k} {initial.get(k, 0)} -> {out[k]}')
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
    # S31: the camera keys came back as the plan's own (director-bridge.py import: no key changed) and the length is
    # the same: the film keeps its plan and its baked camera exactly (no re-bake, nothing thinned or rounded).
    srt = lambda ks: sorted(ks, key=lambda k: k['at'])
    if abs(new_T - old_T) < 1e-9 and src.get('camera') and srt((src.get('cameraPlan') or {}).get('keys') or []) == dc['keys']:
        plan = copy.deepcopy(src['cameraPlan']); camera = copy.deepcopy(src['camera']); new_T = src['seconds']; kept = True
    else: camera = bake(new_T, plan); kept = False
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
        # (a chapter's touchscreen keys are not retimed with its clips: say so when the length changes)
        if s.get('touchscreen') and abs(float(s.get('seconds', seconds)) - seconds) > 1e-6:
            log('    WARNING: touchscreen keys (open / screen at) left as they were for %s -> %s s: retime them by hand' % (s.get('seconds'), seconds))
        s['seconds'] = seconds
        if not kept: s['cameraPlan'] = copy.deepcopy(plan); s['camera'] = copy.deepcopy(camera)      # (kept: each copy keeps its own, hero's sub-shots included)
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
    pv = os.path.join(H, 'previews', 'awaken-v5-cut.json')
    if cid == 'awaken' and os.path.exists(pv):
        # Nov 25 2026 (Vico's 48.3 s chapter 1): the film renders awaken from previews/awaken-v5-cut.json (chapter-keys.py,
        # render-request.sh) and the Director's film shot is made from it (film_list), but only review-cut.json took the
        # import: the render and the Director kept the 44.85 s chapter. Length, camera, desk moves and status lights now go
        # into that copy too (its own look fields - sceneEdits, sceneGlobals, screens - are left as they are; the
        # lighting / props / tray steps already write it). The camera is the cut's own bake whenever its keys differ.
        d = load(pv); s = next((x for x in d['shots'] if x.get('id') == cid), None)
        if s is not None:
            done = cut['shots'][ci]
            same = abs(float(s.get('seconds', -1)) - float(done['seconds'])) < 1e-9 and srt((s.get('cameraPlan') or {}).get('keys') or []) == srt(done['cameraPlan']['keys'])
            put(s, new_cut_T)
            if not same: s['cameraPlan'] = copy.deepcopy(done['cameraPlan']); s['camera'] = copy.deepcopy(done['camera'])
            if dump(pv, d): wrote.append('previews/awaken-v5-cut.json')
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


LIGHT_FIELDS = ('screens', 'ledStatus', 'ledNeutral', 'ledColor', 'lights', 'lightEdits', 'timeOfDay', 'statusLight')   # + Scene lights, Time of day (HQ29/32)
# statusLight (19 Nov 2026, Vico's music chapter): false = no status-indicator light in the chapter (the app's movement cue and
# ledStatus; tools/experience/film-status-light.mjs); true = back to the default, which is the field's absence.
# The Lighting tab's Room section: Room's own light / Room brightness / Fill light / LED glow on the walls / LED glow on the floor
# (ledWallGlow / ledFloorGlow: x the film's approved LED room spill and floor light; film-fx.mjs sceneGlobals).
GLOBAL_FIELDS = ('roomLight', 'exposureScale', 'environmentScale', 'ledWallGlow', 'ledFloorGlow', 'ledFloorSources', 'screenLight')
# screenLight (21 Nov 2026, docs/screen-reflection/CONTRACT.md): the Lighting tab's "Screen light" section, the light a
# media chapter's screens throw onto the desk, floor and walls (film-fx.mjs, experience/screen-light.mjs): {gain,
# saturation, contrast, tint, keepHue}, only what differs from today's. {} = back to the film's default: the pass removes
# the chapter's sceneGlobals.screenLight. (min, max, today's) as experience/screen-light.mjs FIELDS.
SCREEN_LIGHT = {'gain': (0, 3, 1), 'saturation': (0, 3, 1), 'contrast': (.5, 2, 1)}


def clean_screen_light(v):
    """experience/screen-light.mjs cleanScreenLight: the values that differ from today's, clamped, rounded to .001; {} when
    nothing does; None for something that is not an object (then nothing is carried)."""
    if not isinstance(v, dict): return None
    out = {}
    for k, (lo, hi, d) in SCREEN_LIGHT.items():
        n = v.get(k)
        if isinstance(n, bool) or not isinstance(n, (int, float)) or n != n or n in (float('inf'), float('-inf')): continue
        c = round(min(hi, max(lo, float(n))) * 1000) / 1000
        if c != d: out[k] = int(c) if c == int(c) else c
    t = v.get('tint')
    if isinstance(t, str) and re.fullmatch(r'#[0-9a-fA-F]{6}', t) and t.lower() != '#ffffff': out['tint'] = t.lower()
    if v.get('keepHue') is True: out['keepHue'] = True
    return out


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
                elif k == 'statusLight':
                    if lighting[k] is False: s[k] = False
                    else: s.pop(k, None)
                else: s[k] = copy.deepcopy(lighting[k])
            for k in GLOBAL_FIELDS:
                if k not in lighting: continue
                if k == 'screenLight':   # {} = the film's default again: the field is removed
                    mine = clean_screen_light(lighting[k])
                    if mine is None: continue
                    if mine: s.setdefault('sceneGlobals', {})[k] = mine
                    elif 'screenLight' in (s.get('sceneGlobals') or {}): s['sceneGlobals'].pop(k)
                    continue
                s.setdefault('sceneGlobals', {})[k] = copy.deepcopy(lighting[k])
        if dump(p, d): wrote.append(os.path.relpath(p, H))
    # Hero (21 Nov 2026, hero-pro pass): the film renders chapter 12 from its sub-shots (shots/13-subshots.json), so the
    # Director's light rig ('lights' only: each desk keeps its own screens, exposure and LED settings) goes into every
    # sub-shot too, with the same rule (director-* lights and same-named lights replaced). Keyed intensities are chapter
    # seconds, so one keyed rig lights each desk at its own level inside its own window.
    sp = os.path.join(H, 'shots', '13-subshots.json')
    if cid == 'hero' and 'lights' in lighting and os.path.exists(sp):
        d = load(sp); mine = copy.deepcopy(lighting['lights']); names = {l.get('name') for l in mine}
        for s in d['shots']:
            if s.get('id') != cid: continue
            s['lights'] = [l for l in s.get('lights') or [] if not str(l.get('name', '')).startswith('director-') and l.get('name') not in names] + copy.deepcopy(mine)
        if dump(sp, d, indent=None): wrote.append('shots/13-subshots.json')
    return wrote


PROP_FIELDS = ('match', 'asset', 'path', 'near', 'label', 'space', 'position', 'rotation', 'scale', 'hide')
PROP_DESK = re.compile(r'^[a-z0-9-]{1,40}$')
FOLLOW = ('room', 'base-shelf', 'lift', 'desk', 'shelf', 'lower-shelf')


def clean_show(v):
    """A prop's time on screen (experience/prop-edits.mjs cleanShow): {from, to, fadeIn?, fadeOut?, ease?} seconds; None if not one."""
    num = lambda x: isinstance(x, (int, float)) and not isinstance(x, bool) and x == x and abs(x) != float('inf')
    if not isinstance(v, dict) or not num(v.get('from')) or not num(v.get('to')): return None
    a, b = max(0, round(v['from'], 2)), min(100000, round(v['to'], 2))
    if b - a < .1 - 1e-9: return None
    out = {'from': a, 'to': b}
    for k in ('fadeIn', 'fadeOut'):
        if num(v.get(k)) and v[k] > 0: out[k] = min(round(v[k], 2), round(b - a, 2))
    if v.get('ease') == 'smooth' and ('fadeIn' in out or 'fadeOut' in out): out['ease'] = 'smooth'
    return out


def desk_and_show(e, d):
    """The prop's own desk (a sub-shot chapter) and its time on screen, kept on the cleaned edit d."""
    if isinstance(e.get('desk'), str) and PROP_DESK.match(e['desk']): d['desk'] = e['desk']
    show = clean_show(e.get('show'))
    if show: d['show'] = show
    return d


ADD_ASSET = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$')
ADD_ID = re.compile(r'^[A-Za-z0-9]{1,16}$')
ADD_ON = re.compile(r'^[a-z][a-z0-9-]{0,79}$')


def clean_add(e):
    """An added library prop (experience/prop-edits.mjs cleanAddEdit): {add: {asset}, id, match, label, parent, position,
    rotation, scale, on?}, its own transform in the parent's frame (desk: rides the desktop; lift: level at the desktop's
    height; room: the room; on: a room desk's own mounts)."""
    add = e.get('add'); asset = add if isinstance(add, str) else add.get('asset') if isinstance(add, dict) else None
    if not isinstance(asset, str) or not ADD_ASSET.match(asset) or not isinstance(e.get('id'), str) or not ADD_ID.match(e['id']): return None
    num = lambda x: isinstance(x, (int, float)) and not isinstance(x, bool)
    vec = lambda v, d: [x for x in v] if isinstance(v, list) and len(v) == 3 and all(num(x) and abs(x) < 1e4 for x in v) else d
    name = f'Added prop:{asset}#{e["id"]}'
    d = {'add': {'asset': asset}, 'id': e['id'], 'match': '^' + re.sub(r'([.*+?^${}()|\[\]\\/])', r'\\\1', name) + '$'}
    if isinstance(e.get('label'), str) and len(e['label']) <= 120: d['label'] = e['label']
    d['parent'] = e['parent'] if e.get('parent') in ('desk', 'lift', 'shelf', 'lower-shelf', 'base-shelf') else 'room'
    # on: one of the room's other desks (its scene desk record id; 18 Nov 2026, Director "Add to desks"); absent: the featured desk
    if d['parent'] != 'room' and isinstance(e.get('on'), str) and ADD_ON.match(e['on']): d['on'] = e['on']
    d['position'] = vec(e.get('position'), [0, 0, 0]); d['rotation'] = vec(e.get('rotation'), [0, 0, 0])
    sc = vec(e.get('scale'), None)
    d['scale'] = sc if sc and all(.001 <= abs(x) <= 1000 for x in sc) else [1, 1, 1]
    desk_and_show(e, d)
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
        if 'scale' in d and not all(.001 <= abs(x) <= 1000 for x in d['scale']): d.pop('scale')
        if 'hide' in d and not isinstance(d['hide'], bool): d.pop('hide')
        for k in ('asset', 'path', 'label'):
            if k in d and not isinstance(d[k], str): d.pop(k)
        if d.get('space') != 'local' or 'position' not in d: d.pop('space', None)
        # "Travels with" (prop-edits.mjs cleanPlace, film-edits.mjs follow): the surface and its own transform there
        pl = e.get('place') if isinstance(e.get('place'), dict) else None
        pv = lambda v, lim: isinstance(v, list) and len(v) == 3 and all(isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x) and abs(x) < lim for x in v)
        if e.get('follow') in FOLLOW and pl and pv(pl.get('position'), 1e6) and pv(pl.get('rotation'), 721) and pv(pl.get('scale'), 1e6) and all(abs(x) > 1e-6 for x in pl['scale']):
            for k in ('position', 'rotation', 'scale', 'space'): d.pop(k, None)
            d['follow'] = e['follow']; d['place'] = {k: list(pl[k]) for k in ('position', 'rotation', 'scale')}
        desk_and_show(e, d)
        if not any(k in d for k in ('position', 'rotation', 'scale', 'hide', 'show', 'follow')): continue
        d['director'] = True; out.append(d)
    return out


def apply_props(cid, f, props):
    """The chapter's sceneEdits: its hand-made entries as they are, then the Director's (replacing earlier director: true).
    A chapter rendered as sub-shots (hero: shots/13-subshots.json) gets them in every sub-shot too, so the film shows the
    Director's props; an edit kept to one desk (desk: '<preset>') is skipped by film-edits.mjs in the other desks' shots."""
    mine = clean_props(props)
    paths = [CUT] + ([f] if f else []) + ([os.path.join(H, 'previews', 'awaken-v5-cut.json')] if cid == 'awaken' else [])
    if cid == 'hero': paths.append(os.path.join(H, 'shots', '13-subshots.json'))
    wrote = []
    for p in paths:
        if not os.path.exists(p): continue
        d = load(p)
        for s in (d['shots'] if 'shots' in d else [d]):
            if s.get('id') != cid: continue
            hand = [e for e in s.get('sceneEdits') or [] if not e.get('director')]
            if hand or mine: s['sceneEdits'] = hand + copy.deepcopy(mine)
            else: s.pop('sceneEdits', None)
        if dump(p, d, **({'indent': None} if p.endswith('13-subshots.json') else {})): wrote.append(os.path.relpath(p, H))
    return wrote


LOOK = re.compile(r'[a-z0-9-]{1,40}')


def apply_look(cid, f, look):
    """The chapter's room look (room-looks.mjs) on its film shot: review-cut.json, its shot file, awaken's preview cut and
    hero's sub-shots, like apply_props. stage.mjs builds it (an id the room does not have = its default look)."""
    paths = [CUT] + ([f] if f else []) + ([os.path.join(H, 'previews', 'awaken-v5-cut.json')] if cid == 'awaken' else [])
    if cid == 'hero': paths.append(os.path.join(H, 'shots', '13-subshots.json'))
    wrote = []
    for p in paths:
        if not os.path.exists(p): continue
        d = load(p)
        for s in (d['shots'] if 'shots' in d else [d]):
            if s.get('id') == cid: s['look'] = look
        if dump(p, d, **({'indent': None} if p.endswith('13-subshots.json') else {})): wrote.append(os.path.relpath(p, H))
    return wrote


_fin = lambda x: isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)


def archived_pose(v):
    """A pose's shape only (a bone name, four finite numbers not all zero); the numbers are kept exactly."""
    if not isinstance(v, dict): return None
    out = {k: list(q) for k, q in v.items() if re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{0,39}', str(k)) and isinstance(q, list) and len(q) == 4 and all(_fin(x) for x in q) and math.hypot(*q) > 1e-6}
    return out or None


def archived_keys(v):
    if not isinstance(v, list): return None
    out = [k for k in v if isinstance(k, dict) and _fin(k.get('t')) and 0 <= k['t'] <= 36000 and archived_pose(k.get('pose'))
           and len(k['pose']) == len(archived_pose(k['pose']))]
    return out or None


def archived_postures(e):
    """The same checks as people-postures.mjs validateArchivedKeys, on one cast entry (changed in place)."""
    if 'postures' in e:
        if isinstance(e['postures'], dict):
            e['postures'] = {k: r for k, r in e['postures'].items() if re.fullmatch(r'people-[a-z0-9][a-z0-9._-]{0,90}', str(k), re.I) and isinstance(r, dict)}
        else: del e['postures']
    for r in [e, *(e.get('postures') or {}).values()]:
        if r.get('pose') is not None:
            p = archived_pose(r['pose'])
            if p: r['pose'] = p
            else: del r['pose']
        if 'poseKeys' in r and r['poseKeys'] is not None:
            k = archived_keys(r['poseKeys'])
            if k: r['poseKeys'] = k
            else: del r['poseKeys']
    for r in (e.get('postures') or {}).values():
        if 'held' in r:
            h = archived_held(r['held'])
            if h: r['held'] = h
            else: del r['held']


def archived_held(v):
    """people-held-data.mjs archivedHeld: { bone: {at: [3 metres within 2], turn: [3 degrees within 360], scale: .1..10} }, numbers kept."""
    if not isinstance(v, dict): return None
    num = lambda x, lo, hi: isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x) and lo <= x <= hi
    out = {}
    for bone, h in v.items():
        if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{0,39}', str(bone)) or not isinstance(h, dict): continue
        one = {}
        if isinstance(h.get('at'), list) and len(h['at']) == 3 and all(num(x, -2, 2) for x in h['at']): one['at'] = list(h['at'])
        if isinstance(h.get('turn'), list) and len(h['turn']) == 3 and all(num(x, -360, 360) for x in h['turn']): one['turn'] = list(h['turn'])
        if num(h.get('scale'), .1, 10): one['scale'] = h['scale']
        if any(abs(x) > 1e-9 for x in one.get('at', [])) or any(abs(x) > 1e-9 for x in one.get('turn', [])) or abs(one.get('scale', 1) - 1) > 1e-9: out[bone] = one
    return out or None


def clean_people(v):
    """Director Mode's cast for a chapter (experience/people-edits.mjs cleanPeople): {cast: [...], when, chair, fade}; None if not one.
    v2 ({"v": 2, ...}, S31): the film's whole `people` object VERBATIM (only, except, place, chair, fade, when, cast with
    every field, known or not): a deep copy; a cast entry that is not an object with a string id is dropped."""
    if not isinstance(v, dict) or not isinstance(v.get('cast'), list): return None
    if v.get('v') == 2:
        out = copy.deepcopy(v); out['cast'] = [e for e in out['cast'] if isinstance(e, dict) and isinstance(e.get('id'), str)]
        if 'typing' in out:
            if isinstance(out['typing'], (int, float)) and not isinstance(out['typing'], bool) and math.isfinite(out['typing']) and 0 <= out['typing'] <= 2 and abs(out['typing'] - 1) > 1e-3:
                out['typing'] = round(float(out['typing']), 3)
            else:
                out.pop('typing', None)
        return out
    num = lambda x: isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)
    cast, seen = [], set()
    for e in v['cast'][:80]:
        if not isinstance(e, dict) or not isinstance(e.get('id'), str) or not re.fullmatch(r'people-[A-Za-z0-9][A-Za-z0-9._-]{0,90}', e['id']): continue
        key = e.get('key') if isinstance(e.get('key'), str) and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,47}', e['key']) else e['id'][:48]
        if key in seen: continue
        out = {'key': key, 'id': e['id']}
        if e.get('hide') is True: out['hide'] = True
        if e.get('desk') in ('sit', 'stand', 'wheel'):
            out['desk'] = e['desk']
            if isinstance(e.get('station'), str) and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,60}', e['station']): out['station'] = e['station']
            if num(e.get('reach')) and 0 <= e['reach'] <= 3000: out['reach'] = round(e['reach'])
            # their own chair roll and timed roll in / out (experience/people-edits.mjs CHAIR_FIELDS, cleanReachKeys)
            for k, hi in (('sitReach', 3000), ('standReach', 3000), ('chairRoll', 800), ('chairScoot', 300)):
                if num(e.get(k)) and 0 <= e[k] <= hi: out[k] = round(e[k])
            if isinstance(e.get('reachKeys'), list):
                rk = sorted(({'at': round(float(k['at']), 3), 'dur': round(float(max(0, min(30, k['dur']))) if num(k.get('dur')) else 1.5, 3), 'to': round(k['to']), **({'ease': 'linear'} if k.get('ease') == 'linear' else {})}
                             for k in e['reachKeys'][:16] if isinstance(k, dict) and num(k.get('at')) and num(k.get('to')) and 0 <= k['at'] <= 600 and 0 <= k['to'] <= 3000), key=lambda k: k['at'])
                if rk: out['reachKeys'] = rk
        elif isinstance(e.get('at'), list) and len(e['at']) == 2 and all(num(x) and abs(x) <= 100000 for x in e['at']):
            out['at'] = [round(x) for x in e['at']]; out['turn'] = round(float(e['turn']), 1) if num(e.get('turn')) else 0
            if num(e.get('y')) and .5 <= abs(e['y']) <= 5000: out['y'] = round(e['y'])
        elif isinstance(e.get('beside'), list) and len(e['beside']) == 2 and all(num(x) and abs(x) <= 20000 for x in e['beside']): out['beside'] = [round(x) for x in e['beside']]
        else: continue
        # the film's own motion fields, kept as they are (experience/people-edits.mjs KEPT): a walker, a roll, an action, a
        # change of posture, something carried (a walk's end facing, walk.turn, with it) stays one after the import
        for k in ('seat', 'along', 'depth', 'rise', 'toward', 'face', 'clear', 'walk', 'roll', 'act', 'change', 'toes', 'tread', 'carry', 'typeStyle'):
            if k in e:
                try: json.dumps(e[k]); out[k] = copy.deepcopy(e[k])
                except (TypeError, ValueError): pass
        if num(e.get('scale')) and .2 <= e['scale'] <= 3 and abs(e['scale'] - 1) > 1e-3: out['scale'] = round(e['scale'], 3)
        colors = {k: v.lower() for k, v in (e.get('colors') or {}).items() if k in ('top', 'bottom', 'shoes', 'hair') and isinstance(v, str) and re.fullmatch(r'#[0-9a-fA-F]{6}', v)} if isinstance(e.get('colors'), dict) else {}
        if colors: out['colors'] = colors
        # pose fine tuning (experience/people-edits.mjs cleanPose): bone -> quaternion, as the Director cleaned it
        pose = {k: [round(float(x), 4) for x in q] for k, q in (e.get('pose') or {}).items() if re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{0,39}', k) and isinstance(q, list) and len(q) == 4 and all(num(x) and abs(x) <= 1.0001 for x in q)} if isinstance(e.get('pose'), dict) else {}
        if pose: out['pose'] = dict(list(pose.items())[:80])
        # Pose stores and legacy corrections must survive without rounding (people-postures.mjs: only the shape is checked,
        # the numbers stay exactly as they are). Model availability is not a reason to discard an archived posture record.
        for field in ('pose', 'poseKeys', 'postures', 'poseBindings', 'poseSource'):
            if field in e: out[field] = copy.deepcopy(e[field])
        archived_postures(out)
        seen.add(key); cast.append(out)
    res = {'cast': cast}; when = {}
    for key, spans in (v.get('when') or {}).items() if isinstance(v.get('when'), dict) else []:
        good = [[round(float(x), 3) for x in s[:4]] for s in spans[:8] if isinstance(s, list) and len(s) >= 2 and all(num(x) and x >= 0 for x in s[:4]) and s[1] - s[0] >= .01] if isinstance(spans, list) else []
        if key in seen and good: when[key] = good
    if when: res['when'] = when
    c = v.get('chair')
    if isinstance(c, dict) and any(num(c.get(k)) for k in ('back', 'side', 'turn')): res['chair'] = {k: (c[k] if num(c.get(k)) else d) for k, d in (('back', 620), ('side', 0), ('turn', 0))}
    if num(v.get('fade')) and 0 <= v['fade'] <= 5: res['fade'] = v['fade']
    if num(v.get('typing')) and 0 <= v['typing'] <= 2 and abs(v['typing'] - 1) > 1e-3: res['typing'] = round(float(v['typing']), 3)
    return res


def apply_people(cid, f, people):
    """The chapter's `people` (room-people.mjs filter): nobody of the room's own cast, the Director's cast instead."""
    mine = clean_people(people)
    if mine is None: return []
    if mine.get('v') == 2:      # the film's `people` as the Director has it: minus "v", minus hidden entries and their when
        film = {k: v for k, v in mine.items() if k != 'v'}
        hidden = {e.get('key') or e['id'] for e in film['cast'] if e.get('hide') is True}
        film['cast'] = [e for e in film['cast'] if e.get('hide') is not True]
        if isinstance(film.get('when'), dict) and hidden: film['when'] = {k: w for k, w in film['when'].items() if k not in hidden}
    else: film = None
    cast = [] if film else  [{k: v for k, v in e.items() if k != 'hide'} for e in mine['cast'] if not e.get('hide')]; keys = {e['key'] for e in cast}
    if film is None:
        film = {'only': [], 'cast': cast}
        when = {k: v for k, v in (mine.get('when') or {}).items() if k in keys}
        if when: film['when'] = when
        for k in ('chair', 'fade', 'typing'):
            if k in mine: film[k] = mine[k]
    wrote = []
    for p in [CUT] + ([f] if f else []):
        if not os.path.exists(p): continue
        d = load(p)
        for s in (d['shots'] if 'shots' in d else [d]):
            if s.get('id') == cid: s['people'] = copy.deepcopy(film)
        if dump(p, d): wrote.append(os.path.relpath(p, H))
    return wrote


BRANDING_FIELDS = {'surface': str, 'enabled': bool, 'x': (-100, 200), 'y': (-100, 200), 'scale': (5, 300), 'rotation': (-180, 180)}


# The screen look's fields: (min, max, today's value), as experience/screen-look.mjs FIELDS.
SCREEN_LOOK = {'brightness': (.2, 1.5, 1), 'contrast': (.5, 1.5, 1), 'black': (0, .25, 0), 'saturation': (0, 1.5, 1),
               'warmth': (-1, 1, 0), 'glare': (0, 1, 0), 'spill': (0, 2, 1)}
SCREEN_TARGET = re.compile(r'^[\w .:/#()+-]{1,80}$')


def clean_screen_look(v):
    """experience/screen-look.mjs cleanScreenLook: {all?, per?: {target: values}} with only the values that differ from
    today's, each in its range; {} when nothing does (the film's shot then has no screenLook)."""
    def values(x):
        if not isinstance(x, dict): return None
        out = {}
        for k, (lo, hi, d) in SCREEN_LOOK.items():
            n = x.get(k)
            if isinstance(n, bool) or not isinstance(n, (int, float)) or n != n or n in (float('inf'), float('-inf')): continue
            c = round(min(hi, max(lo, float(n))) * 1000) / 1000
            if c != d: out[k] = int(c) if c == int(c) else c
        return out or None
    if not isinstance(v, dict): return {}
    out, per = {}, {}
    a = values(v.get('all'))
    if a: out['all'] = a
    for t, x in list((v.get('per') or {}).items())[:40] if isinstance(v.get('per'), dict) else []:
        c = values(x)
        if c and isinstance(t, str) and SCREEN_TARGET.fullmatch(t): per[t] = c
    if per: out['per'] = per
    return out


def apply_screen_look(cid, f, look):
    """The chapter's film shot gets screenLook (film-fx applies it to the screens); an empty look removes it."""
    mine = clean_screen_look(look)
    paths = [CUT] + ([f] if f else []) + ([os.path.join(H, 'previews', 'awaken-v5-cut.json')] if cid == 'awaken' else [])
    wrote = []
    for p in paths:
        if not os.path.exists(p): continue
        d = load(p)
        for s in (d['shots'] if 'shots' in d else [d]):
            if s.get('id') != cid: continue
            if mine: s['screenLook'] = copy.deepcopy(mine)
            else: s.pop('screenLook', None)
        if dump(p, d): wrote.append(os.path.relpath(p, H))
    return wrote


# The sonar's fields: (min, max), as experience/sonar.mjs FIELDS; the film's own rings per pulse is 3 (not kept).
SONAR_RANGE = {'radius': (6, 600), 'x': (-240, 240), 'z': (-240, 240)}


def clean_sonar(v):
    """experience/sonar.mjs cleanSonar: {enabled?: False, radius?, rings?, x?, z?} with only what differs from the film's,
    clamped, rounded to 0.1 in; {} when nothing does (the film's shot then has no sonar)."""
    if not isinstance(v, dict): return {}
    def num(k):
        n = v.get(k)
        return None if isinstance(n, bool) or not isinstance(n, (int, float)) or n != n or n in (float('inf'), float('-inf')) else float(n)
    out = {}
    if v.get('enabled') is False: out['enabled'] = False
    n = num('radius')
    if n is not None: out['radius'] = math.floor(min(600, max(6, n)) * 10 + .5) / 10
    n = num('rings')
    if n is not None:
        c = min(6, max(1, int(math.floor(n + .5))))
        if c != 3: out['rings'] = c
    for k in ('x', 'z'):
        n = num(k)
        if n is not None:
            c = math.floor(min(240, max(-240, n)) * 10 + .5) / 10
            if c != 0: out[k] = c
    return {k: (int(x) if isinstance(x, float) and x == int(x) else x) for k, x in out.items()}


def apply_sonar(cid, f, sonar):
    """The chapter's film shot gets sonar (stage.mjs reads it); an empty one removes it."""
    mine = clean_sonar(sonar)
    paths = [CUT] + ([f] if f else []) + ([os.path.join(H, 'previews', 'awaken-v5-cut.json')] if cid == 'awaken' else [])
    wrote = []
    for p in paths:
        if not os.path.exists(p): continue
        d = load(p)
        for s in (d['shots'] if 'shots' in d else [d]):
            if s.get('id') != cid: continue
            if mine: s['sonar'] = copy.deepcopy(mine)
            else: s.pop('sonar', None)
        if dump(p, d): wrote.append(os.path.relpath(p, H))
    return wrote


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
    initial are checked here; clips (DeskChoreo) and build (DeskBuild) pass through as the Director cleaned them; hide: true is kept."""
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
        if e.get('hide') is True: d['hide'] = True   # the Desks tab's Hide desk / a Layers eye (film-desk-edits.mjs hideDesk): it was dropped here, so a hidden desk came back in the film
        if any(k not in ('desk', 'name') for k in d): out[d['desk']] = d
    return list(out.values())


def clean_build(b):
    """A desk build as the Director cleaned it (experience/desk-build.mjs cleanDeskBuild): finishes, trim, [{id, slot}], accessory finishes and placements."""
    if not isinstance(b, dict): return None
    out = {}
    for k in ('woodFinish', 'baseFinish'):
        if isinstance(b.get(k), str) and 0 < len(b[k]) <= 60: out[k] = b[k]
    if isinstance(b.get('trimColor'), str) and re.match(r'^#[0-9a-fA-F]{6}$', b['trimColor']): out['trimColor'] = b['trimColor'].lower()
    if isinstance(b.get('accessories'), list):
        acc = [{'id': a['id'], 'slot': a['slot']} for a in b['accessories'][:60] if isinstance(a, dict) and isinstance(a.get('id'), str)
               and a.get('slot') in ('desktop', 'shelf', 'lower-shelf', 'base-shelf')]
        out['accessories'] = acc
    # accessory finishes ({'ergo-keyboard': 'white'}) and placements ({'accessory-id': {role, transform}}): desk-build.mjs
    # cleanBuildFinishes / cleanBuildObjects; the Director has already cleaned them, they pass through as it wrote them
    if isinstance(b.get('accessoryFinishes'), dict) and b['accessoryFinishes']:
        out['accessoryFinishes'] = {k: v for k, v in b['accessoryFinishes'].items() if isinstance(k, str) and isinstance(v, str)}
    if isinstance(b.get('objects'), dict) and b['objects']:
        out['objects'] = {k: copy.deepcopy(v) for k, v in b['objects'].items() if isinstance(k, str) and k.startswith('accessory-') and isinstance(v, dict)}
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


TRAY_JOINTS = {'slide': (0.0, 1.0, 4), 'swing': (-180.0, 180.0, 2), 'baseTilt': (-25.0, 8.0, 2), 'tilt': (-30.0, 30.0, 2)}   # experience/tray-limits.mjs JOINT_LIMITS, tray-pose.mjs DECIMALS (no drop since 25 Nov 2026; base tilt and the arc slot's +-30 since then)
TRAY_KEY_ID = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$')
TRAY_SNAP = 1 / 60


def _jsround(v, n):
    """Math.round(v * 10**n) / 10**n as JavaScript does it (halves up), with no minus zero; whole numbers as ints."""
    k = 10 ** n; r = math.floor(v * k + 0.5) / k + 0.0
    return int(r) if r == int(r) else r


def _tray_pose(v):
    out = {}
    src = v if isinstance(v, dict) else {}
    for j, (lo, hi, n) in TRAY_JOINTS.items():
        if _fin(src.get(j)): out[j] = _jsround(min(hi, max(lo, src[j])), n)
    return out or None


def clean_tray(edits):
    """Director Mode's tray keys (experience/tray-pose.mjs cleanTrayEdits) as the film shot's sceneTray: one edit per desk (the
    later wins, at most 16), each {desk?, initial?, keys?} (an old export's bracket and drop are ignored, SPEC.md 0.3); joints held to their hard limits and rounded as the Director does,
    keys sorted and merged within a sixtieth of a second, at most 64, ease / route only when not the default, unique ids.
    An edit that says nothing is dropped; [] stays [] (it takes the film's own tray keys off)."""
    by = {}
    for e in (edits if isinstance(edits, list) else [])[:64]:
        if not isinstance(e, dict): continue
        out = {}
        if isinstance(e.get('desk'), str) and DESK_ID.match(e['desk']): out['desk'] = e['desk']
        init = _tray_pose(e.get('initial'))
        if init:
            init = {j: x for j, x in init.items() if x != 0}
            if init: out['initial'] = init
        keys = []
        for k in e.get('keys') if isinstance(e.get('keys'), list) else []:
            if not isinstance(k, dict) or not _fin(k.get('t')) or k['t'] < 0 or k['t'] > 3600: continue
            pose = _tray_pose(k.get('pose'))
            if not pose: continue
            key = {}
            if isinstance(k.get('id'), str) and TRAY_KEY_ID.match(k['id']): key['id'] = k['id']
            key['t'] = _jsround(k['t'], 3); key['pose'] = pose
            if k.get('ease') in ('linear', 'hold'): key['ease'] = k['ease']
            if k.get('route') == 'direct': key['route'] = 'direct'
            if isinstance(k.get('label'), str) and k['label'].strip(): key['label'] = k['label'].strip()[:40]
            keys.append(key)
        keys.sort(key=lambda x: x['t'])
        merged = []
        for key in keys:
            last = merged[-1] if merged else None
            if last and key['t'] - last['t'] < TRAY_SNAP - 1e-9:
                last['pose'].update(key['pose'])
                for f in ('ease', 'route', 'label'):
                    if f in key: last[f] = key[f]
                    elif f != 'label': last.pop(f, None)
            else: merged.append(key)
        merged = merged[:64]; used = set()
        for key in merged:
            if 'id' in key and key['id'] not in used: used.add(key['id'])
            else: key.pop('id', None)
        n = 1; final = []
        for key in merged:
            if 'id' not in key:
                while 'k%d' % n in used: n += 1
                used.add('k%d' % n); kid = 'k%d' % n
            else: kid = key['id']
            final.append({'id': kid, **{f: v for f, v in key.items() if f != 'id'}})
        if final: out['keys'] = final
        if 'keys' in out or 'initial' in out: by[out.get('desk', '')] = out
    return list(by.values())[:16]


def apply_tray(cid, f, tray):
    """The chapter's film shot gets sceneTray (the Director's keyboard tray keys; film-fx.mjs plays them with tray-pose.mjs's
    sampler); none removes the field. Like apply_props, a chapter rendered as sub-shots (hero) gets it in every sub-shot, and
    each desk's own keys (desk: '<preset>') are picked per sub-shot by the sampler's pickTrayEdit."""
    mine = clean_tray(tray)
    paths = [CUT] + ([f] if f else []) + ([os.path.join(H, 'previews', 'awaken-v5-cut.json')] if cid == 'awaken' else [])
    if cid == 'hero': paths.append(os.path.join(H, 'shots', '13-subshots.json'))
    wrote = []
    for p in paths:
        if not os.path.exists(p): continue
        d = load(p)
        for s in (d['shots'] if 'shots' in d else [d]):
            if s.get('id') != cid: continue
            if mine: s['sceneTray'] = copy.deepcopy(mine)
            else: s.pop('sceneTray', None)
        if dump(p, d, **({'indent': None} if p.endswith('13-subshots.json') else {})): wrote.append(os.path.relpath(p, H))
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
    """Desk versions as the Director cleaned them (experience/desk-versions-edit.mjs cleanDeskVersionList): hero's
    desks [{n, preset, name, start, end}] in time order (1 to 12; ids A..Z, AA..ZZ), or None."""
    if not isinstance(v, list) or not 1 <= len(v) <= 12: return None
    out = []
    for e in v:
        if not isinstance(e, dict) or not re.match(r'^[A-Z]{1,2}$', str(e.get('n', ''))) or not re.match(r'^[a-z0-9-]{1,40}$', str(e.get('preset', ''))): return None
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
    shots/13.json). Idempotent. Every sub-shot keeps the chapter's camera, light rig and desk performance; seams stay at
    overlap midpoints. The list is the whole chapter: a version the film has no sub-shot for yet is added (a copy of its
    model's sub-shot), a film sub-shot the list does not name is dropped; a dropped model's bundle goes to the director
    file's 'versionLibrary' so a later list can show that model with the film's dressing again."""
    sp = os.path.join(H, 'shots', '13-subshots.json')
    if cid != 'hero' or not os.path.exists(sp): return []
    sub = load(sp); dp = director_file(cid); dc = load(dp) if os.path.exists(dp) else {}
    r = subprocess.run(['node', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'desk-versions-apply.mjs')],
                       input=json.dumps({'subshots': sub['shots'], 'versions': versions, 'library': dc.get('versionLibrary') or []}), capture_output=True, text=True)
    if r.returncode: sys.exit(f'{cid}: desk versions could not be applied: {r.stderr.strip().splitlines()[-1] if r.stderr.strip() else r.returncode}')
    out = json.loads(r.stdout); wrote = []
    if len(out['subshots']) != len(sub['shots']): print(f'    {cid}: {len(sub["shots"])} -> {len(out["subshots"])} sub-shots ({" ".join(s["subshot"] + "=" + s["preset"] for s in out["subshots"])})')
    sub['shots'] = out['subshots']
    if dump(sp, sub, indent=None): wrote.append('shots/13-subshots.json')
    if out.get('library') and out['library'] != dc.get('versionLibrary') and os.path.exists(dp):
        dc['versionLibrary'] = out['library']
        if dump(dp, dc): wrote.append(os.path.basename(dp))
    for p in [CUT] + ([f] if f else []):
        if not os.path.exists(p): continue
        d = load(p)
        for s in (d['shots'] if 'shots' in d else [d]):
            if s.get('id') != cid: continue
            s['subshots'] = copy.deepcopy(out['film']['subshots']); s['presets'] = list(out['film']['presets'])
        if dump(p, d): wrote.append(os.path.relpath(p, H))
    return wrote


def mark_edited(before):
    """S31: a chapter whose review-cut.json entry this pass changed carries directorEdited: {at, fields} (fields: every
    top-level field the Director ever changed there, kept across passes). The cut's generator scripts refuse to overwrite
    a chapter that has it unless told to (see the cut's README). A pass that changes nothing marks nothing."""
    cut = load(CUT); now = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()); marked = []
    for s in cut['shots']:
        b = before.get(s['id'])
        if b is None: continue
        changed = sorted(k for k in set(s) | set(b) if k != 'directorEdited' and s.get(k) != b.get(k))
        if not changed: continue
        old = (b.get('directorEdited') or {}).get('fields') or []
        s['directorEdited'] = {'at': now, 'fields': sorted(set(old) | set(changed))}; marked.append(f"{s['id']} ({', '.join(changed)})")
    if marked and dump(CUT, cut): print('directorEdited: ' + '; '.join(marked))


def run_pass():
    before = {s['id']: copy.deepcopy(s) for s in load(CUT)['shots']}
    run_pass_chapters()
    mark_edited(before)


def run_pass_chapters():
    for n, cid, f in chapters():
        p = director_file(cid)
        if os.path.exists(p) and load(p).get('lighting'):
            w = apply_lighting(cid, f, load(p)['lighting'])
            print(f'ch{n:02d} {cid}: Director lighting ({", ".join(sorted(load(p)["lighting"]))}) -> {", ".join(w) or "no change"}')
        if os.path.exists(p) and 'props' in load(p):
            w = apply_props(cid, f, load(p)['props'])
            print(f'ch{n:02d} {cid}: Director props ({len(load(p)["props"])}) -> {", ".join(w) or "no change"}')
        if os.path.exists(p) and 'people' in load(p):
            w = apply_people(cid, f, load(p)['people'])
            print(f'ch{n:02d} {cid}: Director people ({len([e for e in load(p)["people"].get("cast", []) if not e.get("hide")])}) -> {", ".join(w) or "no change"}')
        if os.path.exists(p) and 'branding' in load(p):
            w = apply_branding(cid, f, load(p)['branding'])
            print(f'ch{n:02d} {cid}: Director branding -> {", ".join(w) or "no change"}')
        if os.path.exists(p) and 'screenLook' in load(p):
            w = apply_screen_look(cid, f, load(p)['screenLook'])
            print(f'ch{n:02d} {cid}: Director screen look -> {", ".join(w) or "no change"}')
        if os.path.exists(p) and 'sonar' in load(p):
            w = apply_sonar(cid, f, load(p)['sonar'])
            print(f'ch{n:02d} {cid}: Director sonar -> {", ".join(w) or "no change"}')
        if os.path.exists(p) and isinstance(load(p).get('look'), str) and LOOK.fullmatch(load(p)['look']):
            w = apply_look(cid, f, load(p)['look'])
            print(f'ch{n:02d} {cid}: Director room look {load(p)["look"]} -> {", ".join(w) or "no change"}')
        if os.path.exists(p) and 'desks' in load(p):
            w = apply_desks(cid, f, load(p)['desks'])
            print(f'ch{n:02d} {cid}: Director desks ({len(clean_desks(load(p)["desks"]))}) -> {", ".join(w) or "no change"}')
        if os.path.exists(p) and 'tray' in load(p):
            w = apply_tray(cid, f, load(p)['tray'])
            print(f'ch{n:02d} {cid}: Director keyboard tray ({len(clean_tray(load(p)["tray"]))} edit(s)) -> {", ".join(w) or "no change"}')
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
        if cid == 'awaken' and not os.path.exists(os.path.join(H, 'cut.json')): continue     # (the master: build-round8-opener.py takes it)
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


def local_screens(screens, where=''):
    """Screen entries with their clips pointed at copies on this machine (local_clip). A clip that is not here is KEPT,
    its src as it was, with missing: true, and named on stderr (21 Nov 2026, the movie's edit list,
    docs/screen-edit-list/CONTRACT.md section 7: dropping it deleted clips from the Director's film shot, and the next
    Export cut wrote the shorter list into the film). The Director shows such a clip as missing and does not play it;
    the import takes the flag off again (export_screens)."""
    out = []
    for sc in screens or []:
        if not isinstance(sc, dict): continue
        c = local_clip(sc.get('src', ''))
        if c: out.append({k: v for k, v in sc.items() if k != 'missing'} | {'src': c})
        else:
            out.append(dict(sc, missing=True))
            print(f'  {where}: screen clip not on this machine, kept (missing): {sc.get("src")}', file=sys.stderr)
    return out


def export_screens(screens):
    """An export's screens as the film keeps them: the Director's missing flag (local_screens) off."""
    return [{k: v for k, v in sc.items() if k != 'missing'} for sc in screens if isinstance(sc, dict)] if isinstance(screens, list) else screens


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
    base, items = '/' + os.path.relpath(os.path.abspath(H), root).replace(os.sep, '/').strip('/'), []
    cl = os.path.join(H, 'director-chapters.json')
    before = {c.get('id'): c for c in load(cl).get('chapters', [])} if os.path.exists(cl) else {}
    for n, cid, page, js, src, cs, mine in rows:
        shot = json.loads(json.dumps(full[cid]))
        if 'screens' in shot: shot['screens'] = local_screens(shot['screens'], cid)
        dump(os.path.join(H, 'director-film', f'{cid}.json'), shot)
        # Chapters the film renders as sub-shots (hero: shots/13-subshots.json, one desk build each): the Director's
        # Desk versions lane and live stage use them (experience/desk-versions.mjs), clips local like the shot's.
        sp = os.path.join(H, 'shots', '13-subshots.json')
        if shot.get('subshots') and cid == 'hero' and os.path.exists(sp):
            subs = []
            for x in load(sp)['shots']:
                x = json.loads(json.dumps(x))
                if 'screens' in x: x['screens'] = local_screens(x['screens'], f'{cid} {x.get("subshot", "")}')
                subs.append(x)
            # The finale renders with --storage post/finale-seed.json (render-finale.sh): its saved builds are the
            # presets' desks, so the Director's stage takes them too (in its memory-only storage).
            seed = os.path.join(H, 'post', 'finale-seed.json')
            # Bundles of film sub-shots an import dropped (apply_versions): the Director dresses that model from them.
            dp = director_file(cid); lib = (load(dp).get('versionLibrary') or []) if os.path.exists(dp) else []
            lib = [dict(x, screens=local_screens(x['screens'], f'{cid} library')) if 'screens' in x else x for x in lib]
            dump(os.path.join(H, 'director-film', f'{cid}-subshots.json'), {'name': load(sp).get('name', ''), 'shots': subs,
                 **({'storage': f'{base}/post/finale-seed.json'} if os.path.exists(seed) else {}), **({'library': lib} if lib else {})}, indent=None)
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


def brand(page, js, cid):
    """A cut other than the master (it has a cut.json: tools/experience/film-cuts.py): its chapters open in the Director
    as projects of their own (id film-<cut>-<chapter>, client = the cut's name), so the browser's drafts and the exports
    of one cut are never taken for another's."""
    cj = os.path.join(H, 'cut.json')
    if not os.path.exists(cj): return
    c = load(cj)
    def mark(cut): cut['id'] = f"film-{c['id']}-{cid}"; cut['client'] = str(c['name'])[:100]; return cut
    h = open(page).read(); m = re.search(r'#cut=([A-Za-z0-9_-]+)', h)
    if m:
        cut = mark(json.loads(base64.urlsafe_b64decode(m.group(1) + '=' * (-len(m.group(1)) % 4))))
        open(page, 'w').write(h[:m.start(1)] + base64.urlsafe_b64encode(json.dumps(cut, separators=(',', ':')).encode()).decode().rstrip('=') + h[m.end(1):])
    if os.path.exists(js): json.dump(mark(load(js)), open(js, 'w'))


def run_pages(ids, downloads):
    rows = []
    for n, cid, f in chapters():
        page, js = page_names(n, cid, downloads)
        if not ids or cid in ids:
            cmd = ['python3', BRIDGE, 'link', plan_source(cid, f), '--html', page, '--json', js] + ([] if f else ['--shot', cid])
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL); brand(page, js, cid)
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
TITLE_PLACES = ('top-left', 'top-right')   # titles-src 'place' (absent = lower-left; film-titles.mjs PLACES)


def clean_typography(v):
    """Director Mode's per-line type and offsets (film-titles.mjs cleanTypography): size, spacing, weight, colour, italic, dx / dy."""
    if not isinstance(v, dict): return None
    num = lambda x: isinstance(x, (int, float)) and not isinstance(x, bool) and abs(x) < float('inf')
    out = {}
    for key in ('eyebrow', 'title', 'detail'):
        a, b = v.get(key), {}
        if not isinstance(a, dict): continue
        for k, lo, hi in (('size', 8, 300), ('spacing', -10, 40)):
            if num(a.get(k)): b[k] = max(lo, min(hi, a[k]))
        for k in ('dx', 'dy'):
            if num(a.get(k)) and abs(a[k]) >= .005: b[k] = round(max(-1000, min(1000, a[k])), 2)
        if a.get('weight') in (400, 500, 600, 700): b['weight'] = a['weight']
        if isinstance(a.get('color'), str) and re.fullmatch(r'#[0-9a-fA-F]{6}', a['color']): b['color'] = a['color']
        if isinstance(a.get('italic'), bool): b['italic'] = a['italic']
        if num(a.get('lineHeight')): b['lineHeight'] = round(max(.5, min(3, a['lineHeight'])), 3)
        if a.get('caps') in ('upper', 'lower'): b['caps'] = a['caps']
        if num(a.get('opacity')) and a['opacity'] < .999: b['opacity'] = round(max(0, min(1, a['opacity'])), 3)
        if num(a.get('strokeW')) and a['strokeW'] >= .05:
            b['strokeW'] = round(min(20, a['strokeW']), 2)
            if isinstance(a.get('strokeColor'), str) and re.fullmatch(r'#[0-9a-fA-F]{6}', a['strokeColor']): b['strokeColor'] = a['strokeColor']
        if num(a.get('shadowDist')): b['shadowDist'] = round(max(0, min(30, a['shadowDist'])), 2)
        if num(a.get('shadowOpacity')): b['shadowOpacity'] = round(max(0, min(1, a['shadowOpacity'])), 3)
        if isinstance(a.get('shadowColor'), str) and re.fullmatch(r'#[0-9a-fA-F]{6}', a['shadowColor']) and a['shadowColor'].lower() != '#000000': b['shadowColor'] = a['shadowColor']
        if b: out[key] = b
    return out or None


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
        for k, n in TITLE_TEXT: e[k] = str(d.get(k) or '').replace('\r\n', '\n').replace('\r', '\n')[:n]
        if isinstance(d.get('position'), dict) and all(isinstance(d['position'].get(k), (int, float)) and abs(d['position'][k]) < float('inf') for k in ('x', 'y')): e['position'] = {k: max(-4000, min(4000, d['position'][k])) for k in ('x', 'y')}
        else: e.pop('position', None)
        sc = d.get('scale')
        if isinstance(sc, (int, float)) and not isinstance(sc, bool) and abs(sc) < float('inf'): e['scale'] = max(.1, min(5, sc))
        else: e.pop('scale', None)
        typ = clean_typography(d.get('typography'))
        if typ: e['typography'] = typ
        else: e.pop('typography', None)
        sh = clean_shadow(d.get('shadow'))
        if sh: e['shadow'] = sh
        else: e.pop('shadow', None)
        if d.get('timed'): e['director_timing'] = True
        else: e.pop('director_timing', None)
        if d.get('place') in TITLE_PLACES: e['place'] = d['place']
        else: e.pop('place', None)
        # text alignment (film-titles.mjs ALIGNS): kept only when it differs from the place's own (left; top-right: right)
        if d.get('align') in ('left', 'center', 'right') and d['align'] != ('right' if e.get('place') == 'top-right' else 'left'): e['align'] = d['align']
        else: e.pop('align', None)
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
        what = [k for k in ('rel_in', 'rel_out', 'eyebrow', 'title', 'detail', 'shadow', 'place') if old.get(k) != e.get(k)]
        log(f'    title {e["rel_in"]:g}-{e["rel_out"]:g} s {e["title"]!r}: {", ".join(what) or "unchanged"}{" (timing set in Director)" if e.get("director_timing") else ""}')
    return [f'titles-src.json (backup titles-src.pre-{tag}.json)']


END_FIELDS = {'logo': (('rel_in', 0, None), ('x', -4000, 4000), ('y', -4000, 4000), ('scale', .1, 5)),
              'cta': (('rel_in', 0, None), ('fade_in', 0, 5), ('size', 8, 300), ('spacing', -10, 40), ('gap', -1000, 1000), ('x', -4000, 4000))}
END_FONTS = ('Poppins', 'Poppins Medium', 'Poppins SemiBold', 'Poppins Bold')   # experience/end-card.mjs CTA_FONTS


def import_end_card(cid, card, seconds, log):
    """The export's endCard (end-card.mjs: the parts he changed) -> titles-src.json 'logo' / 'cta', changed parts edited: true."""
    p = os.path.join(H, 'titles-src.json'); src = load(p)
    isnum = lambda v: isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)
    tidy = lambda v: int(v) if float(v).is_integer() else v
    new = dict(src)
    for part, fields in END_FIELDS.items():
        d = card.get(part)
        if not isinstance(d, dict): continue
        cur = src.get(part)
        if not isinstance(cur, dict) or cur.get('chapter') != cid:
            sys.exit(f'{cid}: the export edits the end card\'s {part}, but titles-src.json has it in {(cur or {}).get("chapter")!r}; import stopped')
        e = copy.deepcopy(cur)
        for k, lo, hi in fields:
            if isnum(d.get(k)): e[k] = tidy(round(max(lo, min(seconds if hi is None else hi, float(d[k]))), 3))
        if part == 'cta':
            if 'rel_out' in d:
                v = d['rel_out']
                e['rel_out'] = None if v is None or not isnum(v) or float(v) >= seconds - .02 else tidy(round(max(e['rel_in'] + .5, min(seconds, float(v))), 3))
            if isinstance(d.get('text'), str): e['text'] = ' '.join(d['text'].split())[:120]
            if d.get('font') in END_FONTS: e['font'] = d['font']
        what = [k for k in e if k != 'edited' and e.get(k) != cur.get(k)]
        if not what: continue
        e['edited'] = True; new[part] = e
        log(f'    end card {part}: ' + ', '.join(f'{k} {cur.get(k)!r} -> {e[k]!r}' for k in what) + ' (edited in the Director)')
        if part == 'logo' and 'rel_in' in what:
            log(f'    the wordmark moved ({cur.get("rel_in")} -> {e["rel_in"]} s): the score\'s logo hit follows it once build-cine-score.py re-fits the score (its --check says so until then)')
    if new == src: return []
    tag = f'director-{cid}-endcard-{time.strftime("%Y%m%d-%H%M%S")}'
    open(os.path.join(H, f'titles-src.pre-{tag}.json'), 'w', encoding='utf-8').write(open(p, encoding='utf-8').read())
    json.dump(new, open(p, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    return [f'titles-src.json (backup titles-src.pre-{tag}.json)']


def run_import(export):
    d = load(export); cid = (d.get('shots') or [{}])[0].get('id')
    known = {c: (n, f) for n, c, f in chapters()}
    if cid not in known:
        name = os.path.basename(export)
        cid = next((c for c in sorted(known, key=len, reverse=True) if name.startswith(f'Film-chapter-{c}')), None)
    if cid not in known: sys.exit(f'{export}: not a film chapter')
    # Never import a named film-cut export into a different cut directory.
    meta_path = os.path.join(H, 'cut.json')
    if str(d.get('id', '')).startswith('film-'):
        target = load(meta_path).get('id') if os.path.isfile(meta_path) else None
        expected = f'film-{target}-{cid}' if target else f'film-{cid}'
        if d['id'] != expected:
            sys.exit(f'{export}: belongs to {d["id"]}, not {expected}; import stopped')
    n, f = known[cid]
    before = load(director_file(cid)) if os.path.exists(director_file(cid)) else {}
    cmd = ['python3', BRIDGE, 'import', export, director_file(cid), '--shot', cid, '--plan', plan_source(cid, f)]
    subprocess.run(cmd, check=True, stdout=sys.stderr)
    # The Lighting lane's edits ride in the export's shot; keep them beside the camera keys and clips (run_pass applies them).
    shot = (d.get('shots') or [{}])[0]
    lighting = {k: shot[k] for k in LIGHT_FIELDS if k in shot}
    if 'screens' in lighting: lighting['screens'] = export_screens(lighting['screens'])   # (the Director's missing flag: not the film's)
    if isinstance(lighting.get('timeOfDay'), list) and len(lighting['timeOfDay']) >= 2:
        tod = lighting['timeOfDay']
        if tod[0].get('at') == 0 and tod[0].get('mode') == 'night' and tod[1].get('at') == 0 and tod[1].get('mode') != 'night':
            lighting['timeOfDay'] = tod[1:]
    for k in GLOBAL_FIELDS:
        if k in (shot.get('sceneGlobals') or {}): lighting[k] = shot['sceneGlobals'][k]
    if 'screenLight' in lighting:
        if clean_screen_light(lighting['screenLight']) is None: lighting.pop('screenLight')
        else: lighting['screenLight'] = clean_screen_light(lighting['screenLight'])
    dc = load(director_file(cid))
    # Starting position (Chapter tab): the export's motion.initial height / tilt, and its wheels start (x, z, yaw: the Rotate
    # row) where it differs from the film's (a copy of the film's own is not kept, so a builder's later placement wins);
    # an export without motion keeps the earlier import's.
    start = (shot.get('motion') or {}).get('initial')
    if isinstance(start, dict) and any(k in start for k in ('height', 'tilt')):
        dc['initial'] = {k: start[k] for k in ('height', 'tilt') if k in start}
        film_shot = load(f) if f else next((s for s in load(CUT)['shots'] if s.get('id') == cid), {})
        film_init = (film_shot.get('motion') or {}).get('initial') or {}
        for k in ('x', 'z', 'yaw'):
            v = start.get(k)
            if isinstance(v, (int, float)) and not isinstance(v, bool) and abs(float(v) - float(film_init.get(k) or 0)) > 1e-6: dc['initial'][k] = v
    elif 'initial' in before: dc['initial'] = before['initial']
    if lighting: dc['lighting'] = lighting
    else: dc.pop('lighting', None)
    # Props: the export's list ([] = he reset them all); an export without the field keeps the earlier import's.
    if isinstance(shot.get('propEdits'), list): dc['props'] = [{k: v for k, v in e.items() if k != 'director'} for e in clean_props(shot['propEdits'])]
    elif 'props' in before: dc['props'] = before['props']
    # S32: room desks are the Desks tab's (the Director folds prop moves on them into their desk edits when a chapter opens);
    # an export that still moves one as a prop is kept as it is (its offset is in world metres, this script cannot turn it
    # into a desk pose) but said out loud.
    for e in dc.get('props', []) if isinstance(shot.get('propEdits'), list) else []:
        if str(e.get('match', '')).rstrip('$').endswith('ErgoFlex desk') or ':station:' in str(e.get('asset', '')):
            print(f'{cid}: WARNING a prop edit moves the room desk {e.get("label") or e.get("match")}: open the chapter in the Director once (it folds it into the desk edit) and export again', file=sys.stderr)
    # People: the export's cast (People tab); an export without the field keeps the earlier import's.
    if clean_people(shot.get('peopleEdits')) is not None: dc['people'] = clean_people(shot['peopleEdits'])
    elif 'people' in before: dc['people'] = before['people']
    # Prop layers (Layers tab: named groups of props, with eye / lock): no film effect, the hide edits above carry it; kept for the Director only.
    if isinstance(shot.get('propLayers'), list): dc['propLayers'] = [l for l in shot['propLayers'] if isinstance(l, dict)][:60]
    elif 'propLayers' in before: dc['propLayers'] = before['propLayers']
    # Branding: the export's overlay (empty = he reset it); an export without the field keeps the earlier import's.
    if isinstance(shot.get('brandingEdits'), dict) and clean_branding(shot['brandingEdits']): dc['branding'] = clean_branding(shot['brandingEdits'])
    elif 'branding' in before: dc['branding'] = before['branding']
    # Screen look (Graphics tab): the export's ({} = he reset it, kept so the pass removes the film's); without the field, the earlier import's.
    if isinstance(shot.get('screenLook'), dict): dc['screenLook'] = clean_screen_look(shot['screenLook'])
    elif 'screenLook' in before: dc['screenLook'] = before['screenLook']
    # Sonar (Graphics tab, a proximity chapter's): the export's ({} = he put it back to the film's, kept so the pass removes the film's); without the field, the earlier import's.
    if isinstance(shot.get('sonar'), dict): dc['sonar'] = clean_sonar(shot['sonar'])
    elif 'sonar' in before: dc['sonar'] = before['sonar']
    # Desks (the room's other ErgoFlex desks): the export's list ([] = he reset them all); an export without the field keeps the earlier import's.
    if isinstance(shot.get('deskEdits'), list): dc['desks'] = clean_desks(shot['deskEdits'])
    elif 'desks' in before: dc['desks'] = before['desks']
    # Keyboard tray keys (the Tray lane): the export's list ([] = he took them all off, kept so the pass removes the film's); an export without the field keeps the earlier import's.
    if isinstance(shot.get('trayEdits'), list): dc['tray'] = clean_tray(shot['trayEdits'])
    elif 'tray' in before: dc['tray'] = before['tray']
    # Featured desk build (Build tab): the export's deskBuild ({} = he reset it); an export without the field keeps the earlier import's.
    if isinstance(shot.get('deskBuild'), dict):
        if clean_build(shot['deskBuild']): dc['build'] = clean_build(shot['deskBuild'])
        else: dc.pop('build', None)
    elif 'build' in before: dc['build'] = before['build']
    # Room look: the export's; an export without the field keeps the earlier import's.
    if isinstance(shot.get('look'), str) and LOOK.fullmatch(shot['look']): dc['look'] = shot['look']
    elif 'look' in before: dc['look'] = before['look']
    # Desk versions (chapter 12's Desk version panel and lane): the export's list; an export without it keeps the earlier import's.
    if 'deskVersions' in shot:
        if clean_versions(shot['deskVersions']): dc['versions'] = clean_versions(shot['deskVersions'])
        else: print(f'{cid}: Director desk versions ignored (not a valid list)', file=sys.stderr)
    elif 'versions' in before: dc['versions'] = before['versions']
    if 'versionLibrary' in before: dc['versionLibrary'] = before['versionLibrary']      # the pass's (apply_versions): dropped film desks' bundles
    dump(director_file(cid), dc)
    if 'versions' in dc: print(f'{cid}: Director desk versions ({" ".join(v["n"] + "=" + v["preset"] for v in dc["versions"])}) kept in {os.path.basename(director_file(cid))}', file=sys.stderr)
    if 'look' in dc: print(f'{cid}: Director room look {dc["look"]} kept in {os.path.basename(director_file(cid))}', file=sys.stderr)
    if 'build' in dc: print(f'{cid}: Director featured desk build kept in {os.path.basename(director_file(cid))}', file=sys.stderr)
    if 'branding' in dc: print(f'{cid}: Director branding -> {sum(len(v) for v in dc["branding"]["artwork"]["surfaces"].values())} graphic edit(s) kept in {os.path.basename(director_file(cid))}', file=sys.stderr)
    if 'desks' in dc: print(f'{cid}: Director desks -> {len(dc["desks"])} desk edit(s) kept in {os.path.basename(director_file(cid))}', file=sys.stderr)
    if 'tray' in dc: print(f'{cid}: Director keyboard tray -> {len(dc["tray"])} tray edit(s) kept in {os.path.basename(director_file(cid))}', file=sys.stderr)
    if 'props' in dc: print(f'{cid}: Director props -> {len(dc["props"])} prop edit(s) kept in {os.path.basename(director_file(cid))}', file=sys.stderr)
    if isinstance(shot.get('filmTitles'), list):
        lines = []; wrote = import_titles(cid, shot['filmTitles'], float(shot.get('seconds') or dc['seconds']), lines.append)
        print(f'{cid}: Director titles -> {", ".join(wrote) or "titles-src.json unchanged"}', file=sys.stderr)
        for l in lines: print(l, file=sys.stderr)
    if isinstance(shot.get('endCard'), dict):
        lines = []; wrote = import_end_card(cid, shot['endCard'], float(shot.get('seconds') or dc['seconds']), lines.append)
        print(f'{cid}: Director end card -> {", ".join(wrote) or "titles-src.json unchanged"}', file=sys.stderr)
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
