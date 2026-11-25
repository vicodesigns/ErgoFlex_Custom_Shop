#!/usr/bin/env python3
"""polish1125 score (Nov 25 2026): Vico's chapter 1 (awaken) at 48.3 s (was 44.85 s, +3.45 s to show the tray), the film after
it, its render source, Director film shot, EDL and score in step. One command, any cut whose awaken Vico has imported at 48.3 s.

    python tools/experience/drafts/polish1125-score/run-all.py <cut> [--dry-run]

Nothing of Vico's picture changes: the 48.3 s chapter, its camera keys, desk moves, status lights, tray keys and titles are
his import (review-cut.json, director-camera.json, titles-src.json) and stay exactly as they are.

  1. the Director pass (build-round8-director.py <cut>): with this commit's importer fix the pass now also writes awaken's
     length, camera, desk moves and status lights into previews/awaken-v5-cut.json, the file the film renders chapter 1
     from (chapter-keys.py, render-request.sh). Before the fix only review-cut.json took his 13:00 / 13:14 imports, so the
     render source (and the Director's film shot made from it) kept the 44.85 s chapter. Its look fields (sceneEdits,
     sceneGlobals, screens) are not touched.
  2. the pages step (--pages awaken --downloads <cut>/director-import): director-film/awaken.json, director-ch01.html and
     director-chapters.json from that file (48.3 s), so a reopened chapter 1 shows his cut, not the 44.85 s one.
  3. <cut>/score-pins.json (backup first): the score's bar lines on every dissolve from rise -> create to storage -> hero,
     where the 44.85 s cut's score had them, + 3.45 s; and the awaken -> rise bar line where the fit puts it with those
     pinned (46.9 s). 3.45 s is 1.64 bars at awaken's 114.3 BPM, so awaken cannot keep its tempo in whole bars:
       chosen: awaken's twin section 15 -> 16 whole bars, 114.29 -> 111.47 BPM (the wake before title B follows it), its
               title-B bar line 12.35 -> 12.45 s (title B is at 12.4 s; the window is +-0.05); rise keeps its 13 bars,
               113.25 -> 111.63 BPM, its first bar line 0.1 s after the rise starts instead of 0.5 s (inside the 0.8 s
               dissolve); create .. hero: same tempo, same bars, every bar line exactly 3.45 s later, the logo hit on the
               wordmark at 244.64 s. No 2/4 bar anywhere; largest tempo step in the film 0.72 % (was 0.97 %).
       not chosen: the three old pins + 3.45 s (rise keeps 113.25 BPM exactly) leaves awaken 66 beats: 16 bars and a 2/4
               bar at 113.3 BPM. Or a chapter of whole bars at the old tempo: 46.95 s (16 bars, -1.35 s) or 49.05 s
               (17 bars, +0.75 s), which changes Vico's picture.
  4. build-cine-score.py <cut> (edl.json, score/score.wav, tempo map, cue sheet) and its --check.
  5. information only: what polish1124-hero3/looks.py would do (the hero's bar lines are unchanged relative to the hero,
     so the desk-version fades stay where they are: no hero edit, no hero re-render).
Titles: titles-src.json keeps chapter seconds (awaken 3.1-8.8, 12.4-17.0, 22.6-27.6 s as Vico set them); every title, the
CTA and the end card after chapter 1 move 3.45 s on the film's timeline through edl.json alone (finish-intro.py).
Do not run it while the director-import watcher is importing. --dry-run runs every step on a temporary copy of the cut
(the score's --plan instead of the WAV), prints what would change in each file, and writes nothing in the cut.
"""
import datetime, importlib.util, json, os, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
EXP = os.path.join(ROOT, 'tools', 'experience')
B8, SCORE = os.path.join(EXP, 'build-round8-director.py'), os.path.join(EXP, 'build-cine-score.py')
LOOKS = os.path.join(EXP, 'drafts', 'polish1124-hero3', 'looks.py')
OLD, NEW = 44.85, 48.3      # awaken before / after Vico's 13:00 export
GROW = round(NEW - OLD, 3)  # 3.45 s


def J(p): return json.load(open(p, encoding='utf-8'))


def step(cmd, dry_note=''):
    print('$ ' + ' '.join(os.path.relpath(c, ROOT) if os.path.isabs(c) and c.startswith(ROOT) else c for c in cmd) + dry_note, flush=True)
    r = subprocess.run(cmd, env=dict(os.environ, PYTHONUTF8='1'), capture_output=True, text=True, encoding='utf-8')
    if r.returncode: sys.stdout.write(r.stdout[-3000:]); sys.stderr.write(r.stderr[-3000:]); raise SystemExit(f'step failed ({r.returncode})')
    return r.stdout


def score_module():
    spec = importlib.util.spec_from_file_location('bcs_score1125', SCORE)
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); m.need_numpy(); return m


def pins_plan(cut):
    """-> (new score-pins.json content or None if already in place, [change text]). The bar lines on the dissolves after
    awaken -> rise from the score the cut has now (score/tempo-map.json, built for the 44.85 s awaken) + GROW, then the fit
    with those pinned chooses awaken -> rise (whole bars), which is pinned too."""
    b = score_module(); edl = b.generate_edl(cut); pic = b.picture(cut, edl)
    tm = J(os.path.join(cut, 'score', 'tempo-map.json'))
    p = os.path.join(cut, 'score-pins.json'); have = J(p) if os.path.exists(p) else {'bar_lines': []}
    if abs(float(tm['total']) + GROW - float(edl['total'])) > 1e-3:
        if abs(float(tm['total']) - float(edl['total'])) < 1e-3 and 'polish1125' in (have.get('note') or ''):
            return None, ['score-pins.json: already the polish1125 pins (the score was built for this cut)']
        sys.exit(f"score/tempo-map.json is for a {tm['total']} s film, the cut is {edl['total']} s: this patch expects the score of the 44.85 s awaken (+{GROW} s)")
    old = tm['tempo']['anchors']        # [title B, awaken->rise, rise->create, ..., storage->hero, logo]
    later = [round(a + GROW, 3) for a in old[2:-1]]
    ids = [c['id'] for c in edl['chapters']]
    pic['pins'] = later; t, _ = b.fit_tempo(b.load_synth(), edl, pic)
    first = round(t['anchors'][1], 3)
    if t['seg_beats'][0] % 4: sys.exit(f"the fit gives awaken {t['seg_beats'][0]} beats (not whole bars): not pinned, look at it by hand")
    want = [first] + later
    new = {'note': f'polish1125 score (Nov 25 2026): awaken 44.85 -> 48.3 s (Vico). Every dissolve bar line from rise -> create to storage -> hero '
                   f'where the 44.85 s cut\'s score had it, + {GROW:g} s (those chapters keep tempo and bars); awaken -> rise where the fit puts it '
                   f'with those pinned: awaken {tm["tempo"]["seg_beats"][0] // 4} ->{t["seg_beats"][0] // 4} whole bars, rise keeps its bars. '
                   f'Earlier note: ' + (have.get('note') or ''),
           'bar_lines': [{'at': a, 'why': f'{ids[i]} -> {ids[i + 1]} dissolve bar line (polish1125 score, awaken 48.3 s)'} for i, a in enumerate(want)]}
    return new, [f'score-pins.json bar lines {[x["at"] for x in have.get("bar_lines", [])]} -> {want}',
                 f"tempo map: anchors {[round(a, 3) for a in t['anchors']]}, beats {t['seg_beats']}, max step {100 * t['max_step']:.2f} %"]


def chapter_keys(cut):
    """{chapter: 4K cache key} (chapter-keys.py), or None when the cut is not under the repo (a scratch copy)."""
    rel = os.path.relpath(os.path.abspath(cut), ROOT)
    if rel.startswith('..'): return None
    r = subprocess.run([sys.executable, os.path.join(EXP, 'chapter-keys.py'), rel, '--resolution', '4K', '--fps', '60', '--json'],
                       capture_output=True, text=True, env=dict(os.environ, PYTHONUTF8='1'))
    return json.loads(r.stdout)['keys'] if r.returncode == 0 else None


def run(cut, dry):
    rc = J(os.path.join(cut, 'review-cut.json')); aw = rc['shots'][0]
    if aw['id'] != 'awaken' or abs(float(aw['seconds']) - NEW) > 1e-6: sys.exit(f"{cut}: awaken is {aw['seconds']} s in review-cut.json, this patch expects Vico's {NEW} s import")
    dc = J(os.path.join(cut, 'director-camera.json'))
    if abs(float(dc['seconds']) - NEW) > 1e-6: sys.exit(f"{cut}: director-camera.json is {dc['seconds']} s, expected {NEW}")
    py = sys.executable
    out = step([py, B8, cut], ' (the pass)')
    print('  ' + '\n  '.join(l for l in out.split('\n') if l.startswith('ch01') or 'LENGTH' in l))
    pv = J(os.path.join(cut, 'previews', 'awaken-v5-cut.json'))['shots'][0]
    if abs(float(pv['seconds']) - NEW) > 1e-6: sys.exit(f"previews/awaken-v5-cut.json is still {pv['seconds']} s: this build-round8-director.py lacks the polish1125 importer fix")
    step([py, B8, cut, '--pages', 'awaken', '--downloads', os.path.join(cut, 'director-import')], ' (the pages step)')
    pins, msg = pins_plan(cut)
    for m in msg: print(('change: ' if pins else '') + m)
    if pins:
        pp = os.path.join(cut, 'score-pins.json')
        if os.path.exists(pp) and not dry: shutil.copyfile(pp, os.path.join(cut, f'score-pins.pre-polish1125-score-{datetime.datetime.now():%Y%m%d-%H%M%S}.json'))
        json.dump(pins, open(pp, 'w', encoding='utf-8', newline='\n'), indent=1, ensure_ascii=False)
    if dry:
        out = step([py, SCORE, cut, '--plan'], ' (dry run: the tempo map only, no WAV)')
        print('  ' + '\n  '.join(l for l in out.split('\n') if l.strip() and not l.startswith('wrote'))[:4000])
    else:
        print(step([py, SCORE, cut]).strip().split('\n')[-1])
        print(step([py, SCORE, cut, '--check']).strip())
    spec = importlib.util.spec_from_file_location('hero_looks', LOOKS); lk = importlib.util.module_from_spec(spec); spec.loader.exec_module(lk)
    p = lk.plan(cut)
    print('(information, not applied) looks.py: ' + '; '.join(f"{f['fade']} now {next(v['start'] for v in p['current'] if v['n'] == f['fade'][-1])} s, on the bar line {f['start']} s" for f in p['fades'])
          + ('' if not p['changed'] else '  (NOT on the bar lines: a hero edit would re-render the hero)'))


def semantic_changes(a_dir, b_dir, tmp_base, cut_base):
    """Files of b_dir that differ from a_dir in content (JSON parsed; pages by their #cut), the temp folder's URL base put back."""
    import base64
    def norm(o): return json.loads(json.dumps(o, sort_keys=True, ensure_ascii=False).replace(tmp_base, cut_base))
    def page_cut(p):
        h = open(p, encoding='utf-8').read(); m = re.search(r'#cut=([A-Za-z0-9_-]+)', h)
        c = json.loads(base64.urlsafe_b64decode(m.group(1) + '=' * (-len(m.group(1)) % 4))) if m else {}
        c.pop('filmUpdated', None); return c
    def walk(a, b, path, acc):
        if isinstance(a, dict) and isinstance(b, dict):
            for k in sorted(set(a) | set(b)):
                if k == 'missing': continue      # local_screens: a clip this machine does not have (machine-dependent)
                if k not in a: acc.append(f'{path}.{k} added')
                elif k not in b: acc.append(f'{path}.{k} removed')
                else: walk(a[k], b[k], f'{path}.{k}', acc)
        elif isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
            for i, (x, y) in enumerate(zip(a, b)): walk(x, y, f'{path}[{i}]', acc)
        elif isinstance(a, list) and isinstance(b, list): acc.append(f'{path} {len(a)} -> {len(b)} items')
        elif a != b: acc.append(f'{path} {json.dumps(a)[:40]} -> {json.dumps(b)[:40]}')
    out = []
    for root, _, files in os.walk(b_dir):
        for f in files:
            pb = os.path.join(root, f); rel = os.path.relpath(pb, b_dir); pa = os.path.join(a_dir, rel)
            if os.path.exists(pa) and open(pa, 'rb').read() == open(pb, 'rb').read(): continue
            if not os.path.exists(pa): out.append((rel, 'new file')); continue
            try:
                if f.endswith('.json'): a, b = norm(J(pa)), norm(J(pb))
                elif f.endswith('.html'): a, b = norm(page_cut(pa)), norm(page_cut(pb))
                else: out.append((rel, 'changed')); continue
            except Exception: out.append((rel, 'changed')); continue
            acc = []; walk(a, b, '', acc)
            if acc: out.append((rel, f'{len(acc)} change(s): ' + '; '.join(acc[:6]) + (' ...' if len(acc) > 6 else '')))
    return sorted(out)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) != 1: sys.exit(__doc__)
    cut, dry = os.path.abspath(args[0]), '--dry-run' in sys.argv
    if not dry:
        keys0 = chapter_keys(cut)
        run(cut, False)
        keys1 = chapter_keys(cut)
        if keys0 and keys1: print('4K60 chapter keys changed: ' + (', '.join(k for k in keys1 if keys0.get(k) != keys1[k]) or 'none'))
        print('done'); return
    tmp = tempfile.mkdtemp(prefix='score1125-'); copy = os.path.join(tmp, os.path.basename(cut))
    try:
        shutil.copytree(cut, copy, ignore=shutil.ignore_patterns('*.wav', '*.mp4', '*.mkv', 'renders', 'final'))
        sw = os.path.join(cut, 'score', 'score.wav')
        if os.path.exists(sw): shutil.copyfile(sw, os.path.join(copy, 'score', 'score.wav'))
        print(f'dry run on a copy of {cut}\n')
        run(copy, True)
        url = lambda d: '/' + os.path.relpath(d, ROOT).replace(os.sep, '/').strip('/')
        print('\nwould change in the cut (score/score.wav, its tempo map, cue sheet, analysis and spectrogram too, on the real run):')
        for rel, what in semantic_changes(cut, copy, url(copy), url(cut)): print(f'  {rel}: {what}')
    finally: shutil.rmtree(tmp, ignore_errors=True)
    print('dry run: nothing written')


if __name__ == '__main__':
    main()
