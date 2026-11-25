#!/usr/bin/env python3
"""The end of a cut's score (tools/experience/build-cine-score.py v2.3, score-synth.tail_layout), Nov 24 2026:
Vico's 3rd cut ends 0.63 s after the wordmark; the old 2.5 s master fade then faded the cadence and the logo hit out.

  1. tail_layout: a long tail (>= END_FADE + TAIL_RING) is exactly as before (2.5 s fade, celesta 0.12 + 0.18 k s);
     a short one fades no earlier than TAIL_RING after the hit, puts the celesta's first D on the hit and the whole
     D-A-D before the fade, and never fades shorter than 0.12 s (no click at the cut to black).
  2. snap_logo: the finale's last bar line (the logo hit) moves exactly onto the wordmark when the steps stay under the
     cap, and stays where the fit put it when they would not.
  3. for each cut: its fit puts the logo hit on the wordmark, keeps every earlier anchor where the fit without the snap
     puts it, every tempo step within the caps (fit 1.0 %, logo snap up to 1.5 %).
  4. if the cut's score/score.wav is built and in step: the hit and the cadence are not faded.
  5. polish1124 hero3/hero4 (25.95 s hero, end-card hold), on a temp copy of each cut, whatever its storage length (no
     film times baked in): run-all.py refuses before the import (when the hero is not yet 25.95 s), --import --dry-run
     writes nothing, then the full run (DRAFT import if needed, apply.py, the desk-version fades on the bar lines, the
     score, --check), and a second dry run has nothing left to do. Then: no pin file; the hero is 25.95 s with a pure
     hold; total = hero start + 25.95; every anchor before the hero exactly as in the cut before the run (earlier
     chapters unchanged); the hit on the wordmark; looks within 0.05 beat of bar lines; fades moved <= 0.8 s from Vico's
     with their lengths; the long tail; the CTA 2 beats (1.0-1.5 s) after the wordmark, fully visible >= 3 s, 72 px
     SemiBold 30 px under the wordmark inside the safe area. Needs python3 and node on PATH; builds a score per cut.

    python3 tests/cine-score-end-test.py [cut dir ...]     (default: exports/cinematic-intro-cut-vicos-3rd-cut)
"""
import importlib.util, os, subprocess, sys
WT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUT = os.path.join(WT, 'exports', 'cinematic-intro-cut-vicos-3rd-cut')
fails = []


def check(ok, what):
    print(('ok   ' if ok else 'FAIL ') + what)
    if not ok: fails.append(what)


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m


synth = load('score_synth', os.path.join(WT, 'tools', 'experience', 'score-synth.py'))
bcs = load('bcs', os.path.join(WT, 'tools', 'experience', 'build-cine-score.py'))
bcs.need_numpy(); np = bcs.np

# 1. tail_layout
beat = 60 / 113.25
lt = synth.tail_layout(240.328, 234.698, beat)
check(lt['fade'] == 2.5 and lt['celesta'] == [0.12 + 0.18 * i for i in range(3)], f'long tail (5.63 s) as before: {lt}')
st = synth.tail_layout(235.328, 234.698, beat); tail = 235.328 - 234.698
check(tail - st['fade'] >= synth.TAIL_RING - 1e-9, f"short tail (0.63 s): the fade starts {tail - st['fade']:.3f} s after the hit (>= {synth.TAIL_RING})")
check(st['fade'] >= 0.12 - 1e-9, f"short tail: fade {st['fade']:.3f} s >= 0.12 s (no click)")
check(st['celesta'][0] == 0.0 and all(d < tail - st['fade'] for d in st['celesta']), f"short tail: celesta D on the hit, D-A-D before the fade {st['celesta']}")
check(abs(st['celesta'][1] - beat / 4) < 1e-9, 'short tail: celesta a 16th apart when the tail holds them')
tiny = synth.tail_layout(235.0, 234.8, beat)
check(tiny['fade'] == 0.12 and tiny['celesta'][-1] <= 0.2 - 0.12 + 1e-9, f'very short tail (0.2 s): 0.12 s fade, celesta compressed {tiny}')
for t in (0.5, 1.0, 2.0, 2.89, 2.9, 3.5):
    x = synth.tail_layout(230 + t, 230, beat)
    check(0.12 - 1e-9 <= x['fade'] <= 2.5 and x['celesta'] == sorted(x['celesta']), f'tail {t} s: fade {x["fade"]:.3f}, celesta {[round(c, 3) for c in x["celesta"]]}')

# 2. snap_logo on a synthetic map: 3 segments of 16 beats at 120 BPM (8 s each); the fit left the end 0.08 s late
bs = np.array([0., 16., 32., 48.]); anchors = [10.0, 18.0, 26.0, 34.08]
got = bcs.snap_logo(anchors, bs, 120.0, 34.0, 0.010)
check(got[:-1] == anchors[:-1] and got[-1] == 34.0, f'snap: end moves onto the wordmark, the rest stays ({got})')
far = bcs.snap_logo(anchors, bs, 120.0, 33.6, 0.010)      # 0.48 s earlier: a 6 % step, over the cap
check(far == anchors, 'snap: refused when the step would exceed the cap')

# 3-5, for every cut given (default: the repo's 3rd cut)
import hashlib, re, shutil, tempfile
CUTS = [os.path.abspath(a) for a in sys.argv[1:] if not a.startswith('--')] or [CUT]
DR = os.path.join(WT, 'tools', 'experience', 'drafts', 'polish1124-hero3')
py3 = shutil.which('python3'); have = bool(py3) and subprocess.run([py3, '-c', 'print(1)'], capture_output=True).returncode == 0 and bool(shutil.which('node'))
HS = 25.95


def fit(cut, edl=None):
    edl = edl or bcs.J(os.path.join(cut, 'edl.json')); pic = bcs.picture(cut, edl)
    t, rep = bcs.fit_tempo(synth, edl, pic); return edl, pic, t, rep


def tree_sha(root):
    h = hashlib.sha256()
    for dp, dn, fn in sorted(os.walk(root)):
        dn.sort()
        for f in sorted(fn): h.update(os.path.relpath(os.path.join(dp, f), root).encode()); h.update(open(os.path.join(dp, f), 'rb').read())
    return h.hexdigest()


def part34(C, tag):
    """3. the cut's own fit: hit on the wordmark, earlier anchors the fit's own, caps; 4. its built score, if in step."""
    edl, pic, tempo, _ = fit(C)
    real = bcs.snap_logo
    bcs.snap_logo = lambda a, *_: a
    try: unsnapped, _ = bcs.fit_tempo(synth, edl, pic)
    finally: bcs.snap_logo = real
    check(abs(tempo['anchors'][-1] - pic['logo']) < 1e-9, f"{tag}: logo hit {tempo['anchors'][-1]} on the wordmark {pic['logo']} (fit alone: {unsnapped['anchors'][-1]})")
    check(tempo['anchors'][:-1] == unsnapped['anchors'][:-1] and tempo['seg_beats'] == unsnapped['seg_beats'] and tempo['bpm'] == unsnapped['bpm'],
          f"{tag}: every earlier anchor, the bar counts and the tempo are the fit's own (earlier chapters unchanged by the snap)")
    pts = sorted(list(zip(tempo['anchors'], np.concatenate([[0], np.cumsum(tempo['seg_beats'])]))) + [tuple(k) for k in tempo['knots']])
    check(bcs.max_step(pts, tempo['bpm']) <= max(tempo['step_cap'], bcs.SNAP_CAP) + 1e-9 <= 0.015 + 1e-9,
          f"{tag}: largest tempo step {100 * bcs.max_step(pts, tempo['bpm']):.2f} % (fit cap {100 * tempo['step_cap']:.2f} %, logo snap up to {100 * bcs.SNAP_CAP:.1f} %)")
    check(all(abs(v / tempo['bpm'] - 1) <= bcs.MAX_BEND for v in bcs.piece_tempos(pts)), f'{tag}: every piece within MAX_BEND')
    wav = os.path.join(C, 'score', 'score.wav')
    if os.path.exists(wav) and not bcs.check(C):
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', wav, '-f', 'f32le', '-ac', '2', '-'], capture_output=True, check=True).stdout
        y = np.frombuffer(raw, '<f4').reshape(-1, 2).astype(np.float64); SR = 48000
        rms = lambda a, b: 20 * np.log10(np.sqrt(np.mean(y[int(a * SR):int(b * SR)] ** 2)) + 1e-12)
        te, total = pic['logo'], float(edl['total']); bar = 4 * 60 / tempo['bpm']
        hit, before, cadence_end = rms(te, te + 0.4), rms(te - bar, te), rms(te - 0.5, te)
        check(hit >= before - 6.0, f"{tag}: built score: the hit's first 0.4 s {hit:.1f} dBFS vs the bar before {before:.1f} dBFS (not faded)")
        check(cadence_end >= before - 6.0, f'{tag}: built score: the last 0.5 s before the hit {cadence_end:.1f} dBFS (the cadence is not faded out)')
        check(abs(len(y) / SR - total) < 1 / SR + 1e-9, f'{tag}: built score: exactly edl.total long ({len(y)} samples)')
    else:
        print(f'skip {tag} built-score checks (no score/score.wav in step)')


def part5(SRC, tag):
    """5. the hero ending (polish1124 hero3/hero4) on a temp copy of the cut, whatever its storage length."""
    tmp = tempfile.mkdtemp(prefix='cine-score-end-test-'); C = os.path.join(tmp, 'cut')
    try:
        shutil.copytree(SRC, C, ignore=shutil.ignore_patterns('score', '*.wav', '*.mp4', '*.mkv'))
        env = dict(os.environ, PYTHONUTF8='1'); RA = os.path.join(DR, 'run-all.py')
        pre_edl = bcs.generate_edl(C); _, _, pre, _ = fit(C, pre_edl)          # this cut as it is (its pin file, if any, applies)
        hero0 = next(c for c in pre_edl['chapters'] if c['id'] == 'hero')
        ready = abs(float(hero0['duration']) - HS) < 1e-9
        if not ready:
            r0 = subprocess.run([py3, RA, C], capture_output=True, text=True, env=env, cwd=tmp)
            check(r0.returncode != 0 and 'import the DRAFT' in (r0.stdout + r0.stderr), f'{tag}: run-all.py refuses while the hero is not {HS} s (no --import)')
        before = tree_sha(C)
        rd = subprocess.run([py3, RA, C, '--import', '--dry-run'], capture_output=True, text=True, env=env, cwd=tmp)
        check(rd.returncode == 0 and tree_sha(C) == before and 'dry run' in rd.stdout, f'{tag}: run-all.py --import --dry-run lists the steps and writes nothing')
        ra = subprocess.run([py3, RA, C] + ([] if ready else ['--import']), capture_output=True, text=True, env=env, cwd=tmp)
        check(ra.returncode == 0 and 'OK: edl.json and score/score.wav are in step' in ra.stdout,
              f'{tag}: run-all.py{"" if ready else " --import"} (import, apply.py, fades on bar lines, score, --check) ({ra.returncode} {(ra.stdout + ra.stderr)[-300:]})')
        rd2 = subprocess.run([py3, RA, C, '--dry-run'], capture_output=True, text=True, env=env, cwd=tmp)
        check(rd2.returncode == 0 and 'nothing to do' in rd2.stdout and 'already on the bar lines' in rd2.stdout, f'{tag}: a second run-all.py --dry-run has nothing left to do')
        check(not os.path.exists(os.path.join(C, 'score-pins.json')), f'{tag}: no score-pins.json left (v2.5 needs none)')
        rc = bcs.J(os.path.join(C, 'review-cut.json')); hero = next(s for s in rc['shots'] if s['id'] == 'hero')
        check(abs(float(hero['seconds']) - HS) < 1e-9, f"{tag}: the hero is {hero['seconds']} s")
        ks = sorted(hero['cameraPlan']['keys'], key=lambda k: k['at']); land, end = ks[-2], ks[-1]
        check(end['at'] == HS and land['position'] == end['position'] and land['target'] == end['target'] and land.get('fov') == end.get('fov'),
              f"{tag}: final pose keyed at {land['at']} s and again at {HS} s (a pure hold)")
        rest = [k for k in hero['camera']['keys'] if k['time'] * HS >= land['at'] - 1e-6]
        drift = max(abs(a - b) for k in rest for a, b in zip(k['view']['position'] + k['view']['target'], land['position'] + land['target']))
        check(drift < 1e-4, f'{tag}: the baked camera rests from {land["at"]} s to {HS} s (largest deviation {drift:.1e} wu)')
        edl2, pic2, t2, rep2 = fit(C)
        hs = next(c['start'] for c in edl2['chapters'] if c['id'] == 'hero')
        check(abs(float(edl2['total']) - (hs + HS)) < 1e-6, f"{tag}: film total {edl2['total']} s = hero start {hs} + {HS}")
        check(t2['anchors'][:-1] == pre['anchors'][:-1] and t2['seg_beats'][:-1] == pre['seg_beats'][:-1] and t2['bpm'] == pre['bpm'],
              f"{tag}: every anchor before the hero as in the cut before run-all.py (storage -> hero {t2['anchors'][-2]}; earlier chapters unchanged)")
        check(abs(t2['anchors'][-1] - pic2['logo']) < 1e-9, f"{tag}: logo hit {t2['anchors'][-1]} on the wordmark {pic2['logo']}")
        looks = [r for r in rep2 if r['kind'] == 'look']
        check(len(looks) == 3 and all(abs(r['off_beats']) <= 0.05 for r in looks), f"{tag}: desk looks on bar lines {[(r['t'], float(r['off_beats'])) for r in looks]}")
        vs = {v['n']: v for v in bcs.J(os.path.join(C, 'director-camera-hero.json'))['versions']}
        moved = [vs['C']['start'] - 4.83, vs['D']['start'] - 9.68, vs['H']['start'] - 14.94]
        check(all(abs(m) <= 0.8 + 1e-9 for m in moved) and abs(vs['B']['end'] - vs['C']['start'] - 0.6) < 1e-6 and abs(vs['C']['end'] - vs['D']['start'] - 0.6) < 1e-6
              and abs(vs['D']['end'] - vs['H']['start'] - 2.0) < 1e-6, f'{tag}: version fades moved {[round(m, 2) for m in moved]} s from Vico\'s (<= 0.8), lengths 0.6 / 0.6 / 2.0 kept')
        check(t2['max_step'] <= 0.015 + 1e-9, f"{tag}: largest step {100 * t2['max_step']:.2f} %")
        tl = synth.tail_layout(float(edl2['total']), pic2['logo'], 1.0)
        check(tl['fade'] == 2.5 and tl['celesta'] == [0.12 + 0.18 * i for i in range(3)], f'{tag}: long tail path {tl}')
        f = subprocess.run([sys.executable, os.path.join(WT, 'tools', 'experience', 'finish-intro.py'), C, '--titles-only'], capture_output=True, text=True, cwd=tmp)
        check(f.returncode == 0 and 'WARNING' not in f.stderr, f'{tag}: finish-intro.py --titles-only ' + f.stderr[-200:])
        tj = bcs.J(os.path.join(C, 'final', 'titles.json')); total = float(edl2['total']); logo = tj['logo']['start']; cta = tj['cta']['start']
        line = [l for l in open(os.path.join(C, 'final', 'titles.ass'), encoding='utf-8').read().split('\n') if ',CTA,' in l][0]
        full = cta + 0.5; fade = total - 1.4; beat = 60 * t2['seg_beats'][-1] / (t2['anchors'][-1] - t2['anchors'][-2])
        check(1.0 <= cta - logo <= 1.5 and abs(cta - logo - 2 * 60 / beat) < 0.011, f'{tag}: CTA at {cta} s, {cta - logo:.3f} s (2 beats at {beat:.2f} BPM) after the wordmark ({logo} s)')
        check(fade - full >= 3.0, f'{tag}: CTA fully visible {full:.3f}-{fade:.3f} s = {fade - full:.2f} s (>= 3 s) before the last fade')
        check(fade - (logo + 1.4) >= 3.0, f'{tag}: wordmark fully visible {logo + 1.4:.3f}-{fade:.3f} s = {fade - logo - 1.4:.2f} s')
        BS = chr(92)
        check(all(BS + t in line for t in ('fad(500,1400)', 'fs72', 'fnPoppins SemiBold', 'fsp2.5', 'an8')) and 'build yours' in line,
              f'{tag}: CTA line: 0.5 s fade-in, 1.4 s fade-out with the film, 72 px Poppins SemiBold, letter-spacing 2.5, top-centred')
        m = re.search(re.escape(BS) + r'move\(960,[0-9.]+,960,([0-9.]+)', line); top = float(m.group(1)) if m else -1
        logo_bottom = 1080 * .73 + 1920 * .22 * 304 / 1400 / 2
        check(abs(top - (logo_bottom + 30)) < 0.6 and top + 72 * 1.25 <= 1080 * 0.95, f"{tag}: CTA line top {top} = the wordmark's bottom {logo_bottom:.1f} + 30 px, bottom inside the safe area")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


for i, C in enumerate(CUTS):
    tag = f'cut {i + 1} ({os.path.basename(os.path.dirname(C)) if os.path.basename(C) == "cut" else os.path.basename(C)})'
    if not os.path.isdir(C): print(f'skip {C} (no cut folder)'); continue
    part34(C, tag)
    if have: part5(C, tag)
    else: print(f'skip {tag} hero checks (needs python3 and node on PATH)')

print(f'{len(fails)} failure(s)' if fails else 'all ok')
sys.exit(1 if fails else 0)
