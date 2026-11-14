#!/usr/bin/env python3
"""The score of a film cut, built from the cut itself (Cinematographer's cut first; works for any cut folder).

    python3 tools/experience/build-cine-score.py exports/cinematic-intro-cut-cine            # EDL + score, then check
    python3 tools/experience/build-cine-score.py <cut> --edl-only       # (re)generate <cut>/edl.json from the cut only
    python3 tools/experience/build-cine-score.py <cut> --check          # exit 1 if edl.json or the score disagree with the cut
    python3 tools/experience/build-cine-score.py <cut> --edl master --out <wav>   # score on the master's EDL (as delivered)

What it reads from the cut folder: review-cut.json (chapter lengths `seconds`, the hard cuts inside chapters = camera keys
with `cut`, the desk's `ledStatus` events), titles-src.json (title A/B, the logo), shots/13-subshots.json (the finale's
desk versions, via join-subshots.py --plan). What it writes (the default run):

  <cut>/edl.json             GENERATED from the cut (never edit by hand): chapters from `seconds`, overlapping by the
                             EDL's dissolve; fps, dissolve and per-seam transitions kept from the cut's edl.json (first run:
                             the master's); beats = title A, title B, the end card (= the logo's first frame), cut to black.
  <cut>/score/score.wav      48 kHz 24-bit stereo, exactly edl.total long (gitignored: build it where the film is frozen)
  <cut>/score/tempo-map.json the tempo map (bar and beat times, per chapter relative to its start, local BPM), the inputs
                             digest the --check compares, the WAV's sha256
  <cut>/score/CUE-SHEET.md, score-analysis.json, score-spectrogram.png

The music is tools/experience/score-synth.py (same instruments, styles and master) with a tempo map fitted to the
picture instead of to the EDL alone:
  * title B, every dissolve and the end card are bar lines, as before, but a dissolve's bar line may sit anywhere inside
    the dissolve's middle (DISSOLVE_SLACK), so every chapter gets whole 4/4 bars (no dropped half bar before a
    transition) at a tempo within MAX_BEND of the film's tempo (no lurch between chapters);
  * the hard cuts inside chapters are pulled onto beats (CUT weight; then a knot in the tempo map where the bend stays
    under KNOT_BEND), the finale's desk-version changes onto bar lines;
  * the title A bloom lands on title A, the logo hit on the wordmark's first frame;
  * the finale changes chord with each desk version (LOOK_CHORDS) instead of holding one chord until the last bars;
  * the desk's movement sounds (assets/led/audio) follow this cut's ledStatus (SFX_RULES), clipped to what the
    chapter shows, mixed before the master (no limiter delay).
Deterministic: same cut and code in, same samples out (seeded noise and dither); the WAV's sha256 is printed and stored.
CPU only: numpy and ffmpeg. About 2 minutes.
"""
import argparse, hashlib, importlib.util, json, math, os, subprocess, sys, time
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
MASTER = 'exports/cinematic-intro-20261104-hq14'
SR = 48000
SEED = 20261030

# ---- knobs (see SCORE-GUIDE.md next to this cut's score) ----
DISSOLVE_SLACK = 0.30      # s: how far a chapter's first bar line may sit from its dissolve centre (and <= 0.45 x dissolve)
MAX_BEND = 0.03            # a chapter's tempo stays within 3 % of the film's
CUT_WEIGHT = 16.0           # cost of a hard cut half a beat off the grid (1.0 = a 1 % tempo bend)
LOOK_WEIGHT = 16.0          # cost of a finale desk-version change half a bar off a bar line
JUMP_WEIGHT = 0.5          # cost of a 1 % tempo step between neighbouring chapters (squared)
HALF_BAR_COST = 20.0       # a chapter that ends on a 2/4 bar (only when whole bars cannot fit within MAX_BEND)
KNOT_BEND = 0.035          # a knot (cut exactly on a beat) may bend the tempo either side by this much,
LOOK_KNOT_BEND = 0.04
KNOT_STEP = 0.05           # and the tempo may step by at most this much at the cut
LOOK_CHORDS = ['D/F#', 'Gmaj9', 'Em9', 'Bm9', 'F#m7', 'Gmaj9', 'Em9', 'A6', 'Bm9', 'Gmaj9', 'Em9']   # one per desk version
LAST_LOOK = ['Gmaj9', 'Asus4', 'A']   # the last version: IV ... Vsus V into the logo (D)
SOUND = {'lift-up': 'movement_lift_up', 'lift-down': 'movement_lift_down', 'tilt-extend': 'movement_tilt_extend',
         'tilt-retract': 'movement_tilt_retract', 'wheels': 'movement_wheels'}
SFX_RULES = {'awaken': set(SOUND), 'commons': {'wheels'}, 'awareness': {'wheels'}, 'storage': set(SOUND)}   # storage: the one-button sequence
SFX_DB = {'wheels': -17.0}; SFX_DB_DEFAULT = -14.0   # relative to the mastered music (as HQ11)
SFX_FADE_IN, SFX_FADE_OUT = 0.3, 0.25


def load_synth():
    spec = importlib.util.spec_from_file_location('score_synth', os.path.join(HERE, 'score-synth.py'))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m


def J(p): return json.load(open(p, encoding='utf-8'))
def sha_file(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for c in iter(lambda: f.read(1 << 20), b''): h.update(c)
    return h.hexdigest()


# ---------------------------------------------------------------------------------------------------------------------
# EDL from the cut
# ---------------------------------------------------------------------------------------------------------------------

def generate_edl(cut_dir):
    cut = J(os.path.join(cut_dir, 'review-cut.json')); src = J(os.path.join(cut_dir, 'titles-src.json'))
    own = os.path.join(cut_dir, 'edl.json')
    base = J(own) if os.path.exists(own) else J(os.path.join(ROOT, MASTER, 'edl.json'))
    X = float(base['dissolve'])
    chs, t = [], 0.0
    for i, s in enumerate(cut['shots']):
        start = 0.0 if i == 0 else round(t - X, 3)
        t = round(start + float(s['seconds']), 3)
        chs.append({'index': i + 1, 'id': s['id'], 'duration': s['seconds'], 'start': start, 'end': t})
    tr = base.get('transitions', [X] * (len(chs) - 1))
    if len(tr) != len(chs) - 1:
        sys.exit(f'edl transitions ({len(tr)}) do not fit {len(chs)} chapters: set them in {own} by hand once, then re-run')
    start = {c['id']: c['start'] for c in chs}
    aw = [x for x in src['titles'] if x['chapter'] == chs[0]['id']]
    logo_at = round(start[src['logo']['chapter']] + src['logo']['rel_in'], 3)
    return {'fps': base['fps'], 'dissolve': X, 'total': t, 'chapters': chs,
            'beats': [{'at': aw[0]['rel_in'], 'what': f"awaken title A: {aw[0]['title']}"},
                      {'at': aw[1]['rel_in'], 'what': f"awaken title B: {aw[1]['title']}"},
                      {'at': logo_at, 'what': 'end card: ErgoFlex wordmark'},
                      {'at': t, 'what': 'cut to black / onboarding'}],
            'notes': 'GENERATED by tools/experience/build-cine-score.py from review-cut.json and titles-src.json; do not edit '
                     '(fps, dissolve and transitions are kept from this file on re-runs). Chapter i plays from start to end; '
                     'consecutive chapters overlap by `dissolve` seconds; transitions: per-seam dissolve [length, shift, type], '
                     'centred on the dissolve centres.',
            'transitions': tr}


def edl_problems(cut_dir, edl):
    """Differences between an edl.json and what the cut says now (empty = in step)."""
    want = generate_edl(cut_dir); p = []
    a = [(c['id'], round(float(c['duration']), 3), round(float(c['start']), 3)) for c in edl['chapters']]
    b = [(c['id'], round(float(c['duration']), 3), round(float(c['start']), 3)) for c in want['chapters']]
    for x, y in zip(a, b):
        if x != y: p.append(f'chapter {y[0]}: edl.json has {x[1]} s from {x[2]}, the cut says {y[1]} s from {y[2]}')
    if len(a) != len(b): p.append(f'edl.json has {len(a)} chapters, the cut {len(b)}')
    if abs(float(edl['total']) - want['total']) > 1e-3: p.append(f"total: edl.json {edl['total']}, the cut {want['total']}")
    if float(edl['dissolve']) != want['dissolve'] or len(edl.get('transitions', [])) != len(b) - 1:
        p.append('dissolve / transitions do not fit the chapters')
    for bw in want['beats']:
        key = bw['what'].split(':')[0]
        have = [x for x in edl.get('beats', []) if x['what'].split(':')[0] == key]
        if not have or abs(float(have[0]['at']) - bw['at']) > 1e-3:
            p.append(f"beat '{key}': edl.json {have[0]['at'] if have else 'missing'}, titles-src says {bw['at']}")
    src = J(os.path.join(cut_dir, 'titles-src.json')); dur = {c['id']: float(c['duration']) for c in want['chapters']}
    for t in src['titles']:
        if t['chapter'] not in dur: p.append(f"title '{t['title']}' is in chapter {t['chapter']}, which the cut does not have")
        elif t['rel_out'] is not None and t['rel_out'] > dur[t['chapter']] + 1e-6:
            p.append(f"title '{t['title']}' ends at {t['rel_out']} s, after its chapter's {dur[t['chapter']]} s")
    return p


# ---------------------------------------------------------------------------------------------------------------------
# picture events (film seconds)
# ---------------------------------------------------------------------------------------------------------------------

def picture(cut_dir, edl):
    cut = J(os.path.join(cut_dir, 'review-cut.json')); src = J(os.path.join(cut_dir, 'titles-src.json'))
    ch = edl['chapters']; X = float(edl['dissolve'])
    tr = [v if isinstance(v, list) else [v, 0] for v in edl.get('transitions', [X] * (len(ch) - 1))]
    xd = [min(X, float(v[0])) for v in tr]; xs = [float(v[1]) for v in tr]
    win = {}
    for i, c in enumerate(ch):
        head = X / 2 + xs[i - 1] - xd[i - 1] / 2 if i else 0.0
        tail = X / 2 - xs[i] - xd[i] / 2 if i < len(ch) - 1 else 0.0
        win[c['id']] = (c['start'], head, float(c['duration']) - tail)       # start, first and last chapter second shown
    shots = {s['id']: s for s in cut['shots']}
    cuts = []
    for cid, (s0, a, b) in win.items():
        for k in shots[cid]['cameraPlan']['keys']:
            if k.get('cut') and a + 0.2 < k['at'] < b - 0.2: cuts.append((round(s0 + k['at'], 3), f"{cid} +{k['at']}"))
    dissolves = [(round((ch[i]['end'] + ch[i + 1]['start']) / 2 + xs[i], 3), xd[i]) for i in range(len(ch) - 1)]
    hero = ch[-1]
    plan = json.loads(subprocess.run([sys.executable, os.path.join(HERE, 'join-subshots.py'), os.path.join(cut_dir, 'shots', '13-subshots.json'),
                                      os.devnull, os.devnull, '--plan'], capture_output=True, text=True, check=True).stdout)
    looks = [round(hero['start'] + st + d / 2, 3) for d, st in plan['fades']]
    aw = [x for x in src['titles'] if x['chapter'] == ch[0]['id']]
    start = {c['id']: c['start'] for c in ch}
    logo_at = start[src['logo']['chapter']] + src['logo']['rel_in']
    led_on = next((e['at'] + e['dur'] for e in shots[ch[0]['id']].get('ledStatus', []) if e['kind'] == 'off'), None)
    sfx = []
    for cid, kinds in SFX_RULES.items():
        if cid not in win: continue
        s0, a, b = win[cid]
        for e in shots[cid].get('ledStatus', []):
            if e['kind'] in kinds:
                t0, t1 = max(a, e['at']), min(b, e['at'] + e['dur'])
                if t1 - t0 > 0.2: sfx.append([round(s0 + t0, 3), round(t1 - t0, 3), e['kind']])
    merged = []
    for at, dur, kind in sorted(sfx):       # back-to-back events of one sound play as one cue
        if merged and merged[-1][2] == kind and abs(merged[-1][0] + merged[-1][1] - at) < 0.05:
            merged[-1][1] = round(at + dur - merged[-1][0], 3)
        else: merged.append([at, dur, kind])
    return dict(cuts=cuts, dissolves=dissolves, looks=looks, title_a=start[ch[0]['id']] + aw[0]['rel_in'],
                title_b=start[ch[0]['id']] + aw[1]['rel_in'], logo=logo_at, led_on=led_on, sfx=merged, win=win)


# ---------------------------------------------------------------------------------------------------------------------
# tempo map fitted to the picture
# ---------------------------------------------------------------------------------------------------------------------

def fit_tempo(synth, edl, pic):
    base, owners, cidx = synth.plan_anchors(edl)
    A = [pic['title_b']] + [pic['dissolves'][i][0] for i in cidx] + [pic['logo']]
    lo = [-0.05] + [-min(DISSOLVE_SLACK, 0.45 * pic['dissolves'][i][1]) for i in cidx] + [0.0]
    hi = [0.05] + [min(DISSOLVE_SLACK, 0.45 * pic['dissolves'][i][1]) for i in cidx] + [0.35]
    D = [np.round(np.arange(l, h + 1e-9, 0.025), 3) for l, h in zip(lo, hi)]
    K = len(A) - 1
    tg = [[] for _ in range(K)]                  # (time, beats per unit, weight) targets inside each segment
    for t, _ in pic['cuts']:
        k = int(np.searchsorted(A, t)) - 1
        if 0 <= k < K: tg[k].append((t, 1, CUT_WEIGHT))
    for t in pic['looks']:
        k = int(np.searchsorted(A, t)) - 1
        if 0 <= k < K: tg[k].append((t, 4, LOOK_WEIGHT))
    pen = [(d / 0.3) ** 2 * 0.5 for d in D]
    best = None
    for bpm in np.arange(104, 124.001, 0.25):
        beat = 60 / bpm
        C, T, NS = [], [], []          # per segment: cost and tempo over (start offset, end offset, beat count)
        for k in range(K):
            ta = A[k] + D[k][:, None, None]; tb = A[k + 1] + D[k + 1][None, :, None]
            L = tb - ta; s_ = (A[k + 1] - A[k]) / beat
            ns = sorted({max(4, 4 * math.floor(s_ / 4)), 4 * math.floor(s_ / 4) + 4, max(2, 2 * round(s_ / 2))})
            ns += [ns[-1]] * (3 - len(ns))
            n = np.array(ns, float)[None, None, :]
            tempo = 60 * n / L; dev = tempo / bpm - 1
            c = (dev / 0.01) ** 2 + np.where(n % 4 == 0, 0.0, HALF_BAR_COST)
            c = np.where(np.abs(dev) <= MAX_BEND, c, np.inf)
            for t, unit, w in tg[k]:
                x = (t - ta) / L * n / unit
                c = c + w * (np.abs(x - np.round(x)) / 0.5) ** 2
            C.append(c); T.append(tempo); NS.append(ns)
        # second-order chain: state = (start offset, end offset, beat count) of the last segment, so the tempo step
        # between neighbouring chapters can be costed (JUMP_WEIGHT per 1 % step, squared)
        V = pen[0][:, None, None] + C[0] + pen[1][None, :, None]; back = []
        for k in range(1, K):
            nb_, nc_ = len(D[k]), len(D[k + 1])
            Vn = np.full((nb_, nc_, 3), np.inf); arg = np.zeros((nb_, nc_, 3), int)
            for bi in range(nb_):
                prev = V[:, bi, :].reshape(-1); tp = T[k - 1][:, bi, :].reshape(-1)
                tn = T[k][bi].reshape(-1)
                J = JUMP_WEIGHT * ((tn[None, :] / tp[:, None] - 1) / 0.01) ** 2
                tot = prev[:, None] + J
                am = tot.argmin(axis=0)
                Vn[bi] = (tot[am, np.arange(len(tn))] + C[k][bi].reshape(-1) + np.repeat(pen[k + 1], 3)).reshape(nc_, 3)
                arg[bi] = am.reshape(nc_, 3)
            V = Vn; back.append(arg)
        flat = int(np.argmin(V)); score = float(V.reshape(-1)[flat]) + 0.05 * abs(bpm - 116)
        if not np.isfinite(score) or (best and score >= best[0]): continue
        bi, ci, ni = np.unravel_index(flat, V.shape)
        idx = [int(ci), int(bi)]; nsel = [NS[K - 1][ni]]
        for k in range(K - 1, 0, -1):
            am = back[k - 1][idx[-1], idx[-2], ni]
            ai, ni = divmod(int(am), 3)
            idx.append(ai); nsel.insert(0, NS[k - 1][ni])
        idx = idx[::-1]
        best = (score, float(bpm), [round(A[k] + float(D[k][idx[k]]), 3) for k in range(K + 1)], nsel)
    if not best: sys.exit('no tempo map within MAX_BEND fits this cut; raise MAX_BEND or DISSOLVE_SLACK')
    _, bpm, anchors, seg = best
    bs = np.concatenate([[0], np.cumsum(seg)]).astype(float)
    pts = list(zip(anchors, bs))
    knots, report = [], []
    for k in range(K):
        for t, unit, w in sorted(tg[k]):
            P = sorted(pts); i = max(j for j in range(len(P)) if P[j][0] <= t)
            (t0, b0), (t1, b1) = P[i], P[i + 1]
            x = b0 + (t - t0) / (t1 - t0) * (b1 - b0)
            ref = bs[0] if unit == 1 else bs[k]          # bars count from the section's first bar
            kk = ref + unit * round((x - ref) / unit)
            off = (x - kk) / unit
            ok = False
            if abs(off) * unit > 0.04 and b0 < kk < b1:
                seg_t = (anchors[k + 1] - anchors[k]) / seg[k]
                r1 = (t - t0) / (kk - b0) / seg_t - 1; r2 = (t1 - t) / (b1 - kk) / seg_t - 1
                lim = KNOT_BEND if unit == 1 else LOOK_KNOT_BEND
                if abs(r1) <= lim and abs(r2) <= lim and abs(r1 - r2) <= KNOT_STEP:
                    pts.append((t, float(kk))); knots.append([t, float(kk)]); ok = True; off = 0.0
            report.append(dict(t=t, kind='cut' if unit == 1 else 'look', off_beats=round(off * unit, 2), knot=ok))
    return dict(bpm=bpm, anchors=anchors, seg_beats=[int(n) for n in seg], knots=knots, title_a=pic['title_a']), report


def hero_chords(plan, pic):
    hero = plan['sections'][-2]
    assert hero['style'] in ('finale', 'hero'), hero['style']
    g = plan['grid']; looks = pic['looks']
    starts = [float(g.t(b)) for b, _ in hero['bars']]
    bar = 60 / plan['bpm'] * 4
    li = [sum(1 for c in looks if c <= t + 0.25 * bar) for t in starts]
    last = len(looks)
    out = []
    n_last = sum(1 for l in li if l == last)
    for i, l in enumerate(li):
        if l < last: out.append(LOOK_CHORDS[l % len(LOOK_CHORDS)])
        else:
            j = i - (len(li) - n_last)
            tailc = LAST_LOOK[-(n_last - j):] if n_last - j <= len(LAST_LOOK) - 1 else None
            out.append(LAST_LOOK[0] if tailc is None or n_last - j > 2 else tailc[0])
    hero['chords'] = out
    return out


# ---------------------------------------------------------------------------------------------------------------------
# movement sounds
# ---------------------------------------------------------------------------------------------------------------------

def decode(name):
    p = os.path.join(ROOT, 'assets', 'led', 'audio', name + '.mp3')
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, '<f4').reshape(-1, 2).T.astype(np.float64)


def sfx_hook(synth, cues):
    def hook(x):
        g0 = -16.0 - synth.integrated_lufs(x)          # the master's gain, near enough: levels are set against the master
        cache = {}
        for at, dur, kind in cues:
            y = cache.setdefault(kind, decode(SOUND[kind]))
            n = int(round(dur * SR)); i0 = int(round(at * SR))
            reps = int(math.ceil(n / y.shape[1])); seg = np.tile(y, reps)[:, :n].copy()
            fi, fo = min(n // 2, int(SFX_FADE_IN * SR)), min(n // 2, int(SFX_FADE_OUT * SR))
            seg[:, :fi] *= synth.fade_in(fi); seg[:, n - fo:] *= synth.fade_out(fo)
            m = min(n, x.shape[1] - i0)
            if m > 0: x[:, i0:i0 + m] += seg[:, :m] * synth.undb(SFX_DB.get(kind, SFX_DB_DEFAULT) - g0)
        return x
    return hook


# ---------------------------------------------------------------------------------------------------------------------

def inputs_digest(cut_dir, edl_bytes):
    """What the score depends on: the EDL used, the cut's titles, finale sub-shots, chapter lengths, cuts and ledStatus,
    and this code. --check compares it with the score's tempo-map.json."""
    cut = J(os.path.join(cut_dir, 'review-cut.json'))
    part = [[s['id'], s['seconds'], [k['at'] for k in s['cameraPlan']['keys'] if k.get('cut')], s.get('ledStatus', [])] for s in cut['shots']]
    h = hashlib.sha256()
    for b in (edl_bytes, open(os.path.join(cut_dir, 'titles-src.json'), 'rb').read(),
              open(os.path.join(cut_dir, 'shots', '13-subshots.json'), 'rb').read(), json.dumps(part, sort_keys=True).encode(),
              open(__file__, 'rb').read(), open(os.path.join(HERE, 'score-synth.py'), 'rb').read()):
        h.update(hashlib.sha256(b.replace(b'\r\n', b'\n')).digest())   # line endings differ between checkouts
    return h.hexdigest()


def tempo_json(plan, tempo, report, pic, edl, wav_sha, digest, edl_src):
    g = plan['grid']; out_ch = {}
    beats = []
    for s in plan['sections']:
        for b0, nb in s.get('bars', []):
            for j in range(nb): beats.append(dict(t=round(float(g.t(b0 + j)), 4), beat=j + 1, bar_beats=nb, section=s['name']))
    for c in edl['chapters']:
        s0, s1 = c['start'], c['end']
        bb = [round(b['t'] - s0, 4) for b in beats if s0 - 1e-6 <= b['t'] <= s1]
        bars = [round(b['t'] - s0, 4) for b in beats if s0 - 1e-6 <= b['t'] <= s1 and b['beat'] == 1]
        sec = [s for s in plan['sections'] if s['name'] == c['id']]
        out_ch[c['id']] = dict(start=s0, music_from=round(sec[0]['t0'] - s0, 4) if sec else None,
                               bpm=round(60 * (sec[0]['b1'] - sec[0]['b0']) / (sec[0]['t1'] - sec[0]['t0']), 3) if sec else None,
                               bars_rel=bars, beats_rel=bb)
    return dict(schema='ergoflex.score-tempo-map', version=1, edl=edl_src, total=edl['total'], bpm_nominal=plan['bpm'],
                sections=[dict(name=s['name'], chapter=s['chapter'], t0=round(s['t0'], 4), t1=round(s['t1'], 4),
                               bpm=round(60 * (s['b1'] - s['b0']) / (s['t1'] - s['t0']), 3) if s.get('bars') else None,
                               chords=s.get('chords')) for s in plan['sections']],
                chapters=out_ch, beats=beats, tempo=tempo, picture_sync=report, sfx=pic['sfx'],
                hits=dict(title_a=pic['title_a'], title_b=pic['title_b'], logo=pic['logo']),
                inputs_sha256=digest, wav_sha256=wav_sha,
                note='Film seconds unless *_rel (seconds from the chapter start). Generated by build-cine-score.py.')


def check(cut_dir):
    p = []; ep = os.path.join(cut_dir, 'edl.json')
    if not os.path.exists(ep): p.append('no edl.json in the cut (run build-cine-score.py <cut>)')
    else: p += edl_problems(cut_dir, J(ep))
    wav = os.path.join(cut_dir, 'score', 'score.wav'); tm = os.path.join(cut_dir, 'score', 'tempo-map.json')
    if not os.path.exists(wav): p.append('no score/score.wav (build it on this machine: build-cine-score.py <cut>)')
    elif not os.path.exists(tm): p.append('no score/tempo-map.json next to the score')
    else:
        t = J(tm)
        if os.path.exists(ep) and t.get('inputs_sha256') != inputs_digest(cut_dir, open(ep, 'rb').read()):
            p.append('score/score.wav was built from other inputs (chapter lengths, cuts, titles, ledStatus, EDL or code changed): re-run build-cine-score.py')
        if t.get('edl') != 'cut': p.append("score/score.wav was built on the master's EDL, not the cut's")
        if t.get('wav_sha256') != sha_file(wav): p.append('score/score.wav is not the file its tempo-map.json describes')
    return p


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('cut'); ap.add_argument('--edl', choices=('cut', 'master'), default='cut')
    ap.add_argument('--out', help='WAV path (default <cut>/score/score.wav; extras next to it)')
    ap.add_argument('--edl-only', action='store_true'); ap.add_argument('--plan', action='store_true', help='print the tempo map and picture sync, write nothing'); ap.add_argument('--check', action='store_true')
    ap.add_argument('--no-extras', action='store_true', help='skip analysis, cue sheet and spectrogram')
    a = ap.parse_args()
    cut_dir = a.cut if os.path.isabs(a.cut) else os.path.join(ROOT, a.cut)
    if a.check:
        p = check(cut_dir)
        for x in p: print('FAIL', x)
        print('OK: edl.json and score/score.wav are in step with the cut' if not p else f'{len(p)} problem(s)')
        sys.exit(1 if p else 0)
    t_start = time.time()
    if a.edl == 'cut':
        edl = generate_edl(cut_dir); ep = os.path.join(cut_dir, 'edl.json')
        txt = json.dumps(edl, indent=1) + '\n'
        if not os.path.exists(ep) or open(ep, encoding='utf-8').read() != txt:
            open(ep, 'w', encoding='utf-8', newline='\n').write(txt); print('wrote', ep, f"(total {edl['total']} s)")
        if a.edl_only: return
    else:
        ep = os.path.join(ROOT, MASTER, 'edl.json'); edl = J(ep)
    edl_bytes = txt.encode() if a.edl == 'cut' else open(ep, 'rb').read()
    synth = load_synth()
    pic = picture(cut_dir, edl)
    tempo, report = fit_tempo(synth, edl, pic)
    if pic['led_on']:      # the wake section starts on the bar nearest the moment the desk lights up
        beat = 60 / tempo['bpm']
        ks = [k for k in range(1, 8) if pic['title_b'] - 4 * k * beat >= pic['title_a'] + 1.0]
        if ks: tempo['wake_k'] = min(ks, key=lambda k: abs(pic['title_b'] - 4 * k * beat - pic['led_on']))
    plan = synth.build_plan(edl, tempo)
    chords = hero_chords(plan, pic)
    print(f"tempo {tempo['bpm']} BPM, segments {tempo['seg_beats']}, knots {len(tempo['knots'])}")
    for s in plan['sections']:
        bpm = 60 * (s['b1'] - s['b0']) / (s['t1'] - s['t0']) if s.get('bars') else 0
        print(f"  {s['name']:<10} {s['t0']:7.2f}-{s['t1']:7.2f} {bpm:7.2f} BPM  {' '.join(s.get('chords', []))}")
    for r in report:
        print(f"  {r['kind']:<4} {r['t']:8.3f}  " + ('on the grid (knot)' if r['knot'] else f"off by {r['off_beats']} beat"))
    print('  sfx', ', '.join(f'{k} {t}+{d}' for t, d, k in pic['sfx']))
    if a.plan: return
    x, events, N = synth.premaster(plan, SEED, hook=sfx_hook(synth, pic['sfx']))
    x, pre_rep = synth.master(x, plan)
    out = a.out or os.path.join(cut_dir, 'score', 'score.wav'); d = os.path.dirname(os.path.abspath(out)); os.makedirs(d, exist_ok=True)
    synth.write_wav24(out, x, np.random.default_rng(SEED + 2))
    wav_sha = sha_file(out)
    tm = tempo_json(plan, tempo, report, pic, edl, wav_sha, inputs_digest(cut_dir, edl_bytes), a.edl)
    open(os.path.join(d, 'tempo-map.json'), 'w', encoding='utf-8', newline='\n').write(json.dumps(tm, indent=1) + '\n')
    if not a.no_extras:
        rep = synth.analyze(x, plan, events); rep['master'] = pre_rep; meas = synth.ffmpeg_measure(out); rep['ffmpeg'] = meas
        rep['tempo'] = dict(bpm=plan['bpm'], seg_beats=plan['seg_beats'], knots=tempo['knots'], max_bend_pct=round(100 * float(np.max(plan['devs'])), 2))
        open(os.path.join(d, 'score-analysis.json'), 'w', encoding='utf-8', newline='\n').write(json.dumps(rep, indent=1) + '\n')
        cs = os.path.join(d, 'CUE-SHEET.md')
        synth.write_cue_sheet(cs, plan, events, meas, rep, os.path.abspath(ep), os.path.abspath(out))
        txt = open(cs, encoding='utf-8').read()
        rel_cut = os.path.relpath(cut_dir, ROOT).replace(os.sep, '/')
        txt = txt.split('\n## Re-render')[0].replace('Generated by `tools/experience/score-synth.py`', 'Generated by `tools/experience/build-cine-score.py` (score-synth.py instruments)')
        txt = txt.replace(' (= chapter i end - dissolve/2), which is also the bar line', ' (moved by at most 0.3 s inside the dissolve), which is also the bar line')
        txt += ('\n## Picture sync\n\n| time | what | off the grid |\n|---:|---|---|\n'
                + ''.join(f"| {r['t']:.3f} | {r['kind']} | {'on a beat (knot)' if r['knot'] and r['kind'] == 'cut' else 'on a bar (knot)' if r['knot'] else str(r['off_beats']) + ' beat'} |\n" for r in report)
                + '\nMovement sounds (from the cut\'s ledStatus): ' + ', '.join(f'{k} {t:.2f} s for {du:.2f} s' for t, du, k in pic['sfx'])
                + f"\n\nFinale chords per bar: {' '.join(chords)}\n\n## Re-render\n\n```\npython3 tools/experience/build-cine-score.py {rel_cut}\n```\n")
        open(cs, 'w', encoding='utf-8', newline='\n').write(txt)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', out, '-lavfi', 'showspectrumpic=s=1920x720:mode=combined:color=intensity:scale=log:fscale=lin:legend=1',
                        os.path.join(d, 'score-spectrogram.png')], check=True)
        print(f"ffmpeg: I={meas.get('I')} LUFS TP={meas.get('TP')} dBTP LRA={meas.get('LRA')}")
    print(f'wrote {out}  {N} samples ({N / SR:.3f} s)  sha256 {wav_sha}  in {time.time() - t_start:.0f} s')
    if a.edl == 'cut' and not a.out:
        p = check(cut_dir)
        for x_ in p: print('FAIL', x_)
        if p: sys.exit(1)
        print('check OK')


if __name__ == '__main__':
    main()
