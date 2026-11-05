#!/usr/bin/env python3
"""Director Mode round trip for chapters 2-12 (chapter 1, awaken, stays with build-round8-opener.py).

  build-round8-director.py <hq dir>
      The pass. Runs LAST in the builder chain (leds -> opener -> rise -> wellness -> create-commons -> this), under
      flock /tmp/claude-1000/hq14-cut.lock. For every chapter but awaken with <hq>/director-camera-<id>.json
      (director-bridge.py import --shot <id> --plan <its shot>):
      - seconds = the import's (the render length: shots/NN.json; a review-cut chapter trimmed shorter than its render
        (coast, music, media) keeps its trim, clamped to the new length). A length change is reported: the EDL and
        the score are NOT retimed here.
      - cameraPlan.keys = the import's keys (hold kept by director-bridge --plan), the plan's other fields kept;
        camera re-baked from it with camera-spline.mjs.
      - motion clips overridden by id from the import ('clips'): fields id lane kind start duration easing label
        target value direction path; clips he added are kept, clips he deleted are dropped.
      - ledStatus re-timed for the clips whose start/duration changed (or that he deleted), see retime_status().
      Writes the chapter's shots/NN.json (oilers has none: review-cut only), its review-cut.json entry and, for hero,
      every sub-shot in shots/13-subshots.json (renderRange kept; the last one follows a length change). Files are
      only rewritten when their content changes, so chapters without a director file are left byte-for-byte alone.
      rise, wellness, create and commons: their builders leave the camera (cameraPlan + camera) to this pass when the
      director file exists (create's builder still resets its authored motion + ledStatus, which this pass re-times).

  build-round8-director.py <hq dir> --pages [id ...] [--downloads DIR]
      Director pages + import files (all chapters if no id): <hq>/director-chNN-<id>.html (chapter 1:
      director-ch01.html) and DIR/ErgoFlex-film-chNN-<id>-director.json (DIR default ~/Downloads), and
      <hq>/director-index.html linking every chapter page. Open via http://127.0.0.1:3000/<hq>/director-index.html.

  build-round8-director.py <hq dir> --import <exported cut.json>
      Reads the chapter id from the export, runs director-bridge.py import into director-camera.json (awaken) or
      director-camera-<id>.json with --shot <id> --plan <its shot>, prints the id. Run it under the cut lock.
"""
import copy, glob, html, json, os, subprocess, sys, tempfile

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


def retime_status(events, old_clips, new_clips, old_T, new_T, initial, log):
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
    d_old, d_new = directions(old_clips, initial), directions(new_clips, initial)
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
    if 'clips' in dc and (motion or dc['clips']):
        motion = dict(motion or {'version': 2, 'initial': {'height': 30, 'tilt': 0, 'x': 0, 'z': 0, 'yaw': 0}})
        old_clips = motion.get('clips') or []
        motion['clips'] = merge_clips(old_clips, dc['clips'])
        late = [c['id'] for c in motion['clips'] if c['start'] + c['duration'] > new_T + 1e-4]
        if late: sys.exit(f'{cid}: clips {late} run past the {new_T} s chapter')
        if status: status = retime_status(status, old_clips, motion['clips'], old_T, new_T, motion.get('initial'), log)
        gone = sorted({c['id'] for c in old_clips} - {c['id'] for c in motion['clips']})
        added = sorted({c['id'] for c in motion['clips']} - {c['id'] for c in old_clips})
        moved = [c['id'] for c in old_clips if c['id'] not in gone and next(x for x in motion['clips'] if x['id'] == c['id']) != c]
        if gone or added or moved: log(f'    clips: changed {moved or "-"}, deleted {gone or "-"}, added {added or "-"} (added clips get no status light)')
    elif 'clips' not in dc: log('    import has no clips: motion and status lights left as they are')

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


def run_pass():
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
    li = []
    for n, cid, page, js, src, cs, mine in rows:
        T, cT = float(src['seconds']), float(cs['seconds'])
        trim = f'; the film uses the first {cT:g} s' if cT < T - 1e-6 else ''
        li.append(f'<li><a href="{html.escape(page)}">Chapter {n}: {html.escape(cid)}</a> <small>{T:g} s, '
                  f'{len(src["cameraPlan"]["keys"])} camera keys, {len((src.get("motion") or {}).get("clips") or [])} desk moves{trim}'
                  f'{"; your Director edit is in" if mine else ""} &middot; import file {html.escape(js)}</small></li>')
    open(os.path.join(H, 'director-index.html'), 'w').write(
        '<!doctype html><meta charset="utf-8"><title>ErgoFlex film: Director Mode chapters</title>\n'
        '<script>if(location.hostname==="localhost")location.hostname="127.0.0.1"</script>\n'
        '<style>body{font:16px/1.6 system-ui,sans-serif;margin:2em;max-width:60em}small{color:#666}</style>\n'
        '<h1>ErgoFlex film: Director Mode chapters</h1>\n'
        '<p>Open a chapter, tune the camera keys and desk moves, then <b>Export cut</b>: the film picks the export up '
        'from Downloads. If a page does not open the cut, use Director Mode\'s <b>Import cut</b> with the chapter\'s '
        'import file in Downloads.</p>\n<ol>\n' + '\n'.join(li) + '\n</ol>\n')


def run_import(export):
    d = load(export); cid = (d.get('shots') or [{}])[0].get('id')
    known = {c: (n, f) for n, c, f in chapters()}
    if cid not in known:
        name = os.path.basename(export)
        cid = next((c for c in sorted(known, key=len, reverse=True) if name.startswith(f'Film-chapter-{c}')), None)
    if cid not in known: sys.exit(f'{export}: not a film chapter')
    n, f = known[cid]
    cmd = ['python3', BRIDGE, 'import', export, director_file(cid), '--shot', cid, '--plan', plan_source(cid, f)]
    subprocess.run(cmd, check=True, stdout=sys.stderr)
    print(cid)


if '--pages' in args:
    downloads = opt('--downloads', os.path.expanduser('~/Downloads')); args.remove('--pages'); run_pages(args, downloads)
elif '--import' in args:
    run_import(opt('--import'))
elif not args:
    run_pass()
else:
    sys.exit(__doc__)
