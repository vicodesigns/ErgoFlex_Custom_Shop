#!/usr/bin/env python3
"""polish1124 commons5 (Nov 25 2026): Commons (chapter 4) 16 -> 20.3 s, Mia's phone set down at a believable pace and ~4 s of
typing before the chapter ends; the film after it, its EDL, score and the finale's looks in step. One command, any cut.

    python tools/experience/drafts/polish1124-commons5/run-all.py <cut> [--dry-run]

  1. tools/experience/build-polish1124-commons.py <cut> <tmp>: the chapter's DRAFT Director export from the cut's own files
     (Mia's put-down ~0.6 s slower: touch down 14.8 s, let go 14.88 s, hands on the keys 15.77 s, the typing model from
     16.07 s; Commons4's seat / wheelchair / handsBy; the chapter 20.3 s, every camera key on its own second and one more at
     20.3 s carrying the closing push on at its own speed). Skipped when the chapter is already 20.3 s (re-runs do the rest).
  1b. <cut>/score-pins.json (backup first): the score's bar lines on the three dissolves before commons, as the cut's score
     has them now (build-cine-score.py v2.4 pins), so awaken, rise and create keep their music exactly; without them the
     fit re-chooses the whole film's tempo (~112 -> ~107 BPM). With the 4.3 s (two bars) the fit gives every chapter after commons the tempo and bars it had, 4.3 s later.
  2. the Director import path, as the director-import watcher runs it: build-round8-director.py <cut> --import <draft>,
     the pass (build-round8-director.py <cut>), then step 3, then the pages step (--pages commons --downloads
     <cut>/director-import).
  3. the phone's glow cue (a hand-made sceneEdits entry the import cannot carry): review-cut.json's commons entry gets the
     draft's phone-cue-patch.json keys (lit 14.88 s, charging flash 15.53 s, settles to 0.6 at 16.58 s); backup first
     (review-cut.pre-polish1124-commons5-<time>.json). The pages step then writes it into director-film/commons.json.
  4. build-cine-score.py <cut> (edl.json, score/score.wav, tempo map) and its --check. The hero is NOT touched: 4.3 s is two
     whole bars, so the finale's bar lines, the CTA's beat and the desk-version fades stay exactly where they were relative
     to the hero (its render cache stays good). What tools/experience/drafts/polish1124-hero3/looks.py would do on this
     cut is printed for information only (the live cut's fades sit up to 0.8 beat off the bar lines before and after this
     patch alike; putting them on the lines is a separate hero edit that re-renders the hero).
Every other chapter's own data is unchanged; the chapters after commons start 4.3 s later on the film's timeline (edl.json).
Do not run it while the director-import watcher is importing. --dry-run prints the plan and writes nothing.
"""
import datetime, json, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
EXP = os.path.join(ROOT, 'tools', 'experience')
B8, BUILD, SCORE = os.path.join(EXP, 'build-round8-director.py'), os.path.join(EXP, 'build-polish1124-commons.py'), os.path.join(EXP, 'build-cine-score.py')
LOOKS = os.path.join(EXP, 'drafts', 'polish1124-hero3', 'looks.py')
SECONDS = 20.3   # two bars of the score at commons (~111.3 BPM): the chapters after it keep their tempo and bar lines, 4.3 s later
PHONE = ('Added prop:ergoflex-phone#mph01', '^hUlRcbieVuIiOXG$')


def step(cmd, dry):
    print('$ ' + ' '.join(os.path.relpath(c, ROOT) if os.path.isabs(c) and c.startswith(ROOT) else c for c in cmd), flush=True)
    if not dry: subprocess.run(cmd, check=True, env=dict(os.environ, PYTHONUTF8='1'))      # (UTF-8 pipes on Windows too: without it the pass re-writes the hero's sub-shot labels as mojibake)


def commons(cut):
    rc = json.load(open(os.path.join(cut, 'review-cut.json'), encoding='utf-8'))
    return rc, next(s for s in rc['shots'] if s['id'] == 'commons')


def cue_patch(cut, keys, dry):
    rc, shot = commons(cut)
    e = next((e for e in shot.get('sceneEdits', []) if e.get('path') == PHONE[0] and e.get('materialName') == PHONE[1]), None)
    if e is None: sys.exit('review-cut.json commons: no phone glow edit (Added prop:ergoflex-phone#mph01): not patched')
    was = e['material'].get('emissiveIntensity')
    if was == keys: print('phone glow cue: already', keys); return
    print(('would change: ' if dry else 'change: ') + f'review-cut.json commons phone glow {was} -> {keys}')
    if dry: return
    p = os.path.join(cut, 'review-cut.json')
    shutil.copyfile(p, os.path.join(cut, f'review-cut.pre-polish1124-commons5-{datetime.datetime.now():%Y%m%d-%H%M%S}.json'))
    e['material']['emissiveIntensity'] = keys
    json.dump(rc, open(p, 'w', encoding='utf-8', newline='\n'), indent=1, ensure_ascii=False)


def score_module():
    import importlib.util
    spec = importlib.util.spec_from_file_location('bcs_commons5', os.path.join(EXP, 'build-cine-score.py'))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); m.need_numpy(); return m


def pins_plan(cut):
    """-> (new score-pins.json content, [change text]). The score's bar lines on the dissolves BEFORE commons (awaken -> rise,
    rise -> create, create -> commons), as this cut's score has them now: pinned, so lengthening commons does not retime the
    music of the three chapters before it (without pins the fit re-chooses the whole film's tempo: ~112 -> ~107 BPM). Pins
    already in the file that lie after commons move with the picture (+ the length added)."""
    b = score_module(); edl = b.generate_edl(cut); pic = b.picture(cut, edl)
    t, _ = b.fit_tempo(b.load_synth(), edl, pic)
    ids = [c['id'] for c in edl['chapters']]; ci = ids.index('commons'); grow = SECONDS - float(edl['chapters'][ci]['duration'])
    near = lambda c: min(t['anchors'], key=lambda a: abs(a - c))
    want = [round(near(c), 3) for c, _ in pic['dissolves'][:ci]]
    p = os.path.join(cut, 'score-pins.json'); have = json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {'bar_lines': []}
    end = edl['chapters'][ci]['start'] + float(edl['chapters'][ci]['duration'])
    kept = [dict(x, at=round(float(x['at']) + (grow if float(x['at']) > end - 1 else 0), 3)) for x in have.get('bar_lines', []) if all(abs(float(x['at']) - w) > 1e-3 for w in want)]
    new = {'note': f'polish1124 commons5 (Nov 25 2026): the dissolve bar lines before commons pinned where the 16 s commons had them, so the 20.3 s commons does not retime awaken, rise and create; '
                   f'pins after commons (if any) moved {grow:g} s with the picture. ' + (have.get('note') or ''),
           'bar_lines': [{'at': a, 'why': f'{ids[i]} -> {ids[i + 1]} dissolve bar line (commons 16 s fit, polish1124 commons5)'} for i, a in enumerate(want)] + kept}
    return new, [f'score-pins.json bar lines {[x["at"] for x in have.get("bar_lines", [])]} -> {[x["at"] for x in new["bar_lines"]]}']


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) != 1: sys.exit(__doc__)
    cut, dry, py = args[0], '--dry-run' in sys.argv, sys.executable
    _, shot = commons(cut); now = float(shot['seconds'])
    tmp = tempfile.mkdtemp(prefix='commons5-')
    try:
        subprocess.run([py, BUILD, cut, tmp, '--seconds', str(SECONDS)], check=True, stdout=subprocess.DEVNULL, env=dict(os.environ, PYTHONUTF8='1'))   # (writes only into tmp: also on a dry run, for the plan)
        draft = os.path.join(tmp, 'Film-chapter-commons-polish1124.json')
        exp = json.load(open(draft, encoding='utf-8'))['shots'][0]
        keys = json.load(open(os.path.join(tmp, 'phone-cue-patch.json'), encoding='utf-8'))['emissiveIntensity']
        print(f"commons is {now:g} s; the draft: {exp['seconds']:g} s, Mia {exp['peopleEdits']['when']['mia-waits']} -> {exp['peopleEdits']['when']['mia-works']}, "
              f"camera keys at {[round(k['time'] * exp['seconds'], 3) for k in exp['camera']['keys']]}")
        if abs(now - SECONDS) > 1e-6:
            if abs(now - 16) > 1e-6: sys.exit(f'commons is {now} s in {cut}: this patch expects 16 s (or {SECONDS:g} s, already imported)')
            pins, msg = pins_plan(cut)
            for m in msg: print(('would change: ' if dry else 'change: ') + m)
            if not dry:
                pp = os.path.join(cut, 'score-pins.json')
                if os.path.exists(pp): shutil.copyfile(pp, os.path.join(cut, f'score-pins.pre-polish1124-commons5-{datetime.datetime.now():%Y%m%d-%H%M%S}.json'))
                json.dump(pins, open(pp, 'w', encoding='utf-8', newline='\n'), indent=1, ensure_ascii=False)
            if dry: print('(dry run: the draft is not imported; the steps that follow would run on the imported cut)')
            step([py, B8, cut, '--import', draft], dry)
        else: print(f'commons already {SECONDS:g} s: import skipped')
        step([py, B8, cut], dry)
        if dry: print(f'would change: review-cut.json commons phone glow -> {keys}')
        else: cue_patch(cut, keys, dry)
        step([py, B8, cut, '--pages', 'commons', '--downloads', os.path.join(cut, 'director-import')], dry)
        step([py, SCORE, cut], dry)
        step([py, SCORE, cut, '--check'], dry)
        if not (dry and abs(now - SECONDS) > 1e-6):
            import importlib.util
            spec = importlib.util.spec_from_file_location('hero_looks', LOOKS); lk = importlib.util.module_from_spec(spec); spec.loader.exec_module(lk)
            p = lk.plan(cut)
            print('(information, not applied) looks.py: ' + '; '.join(f"{f['fade']} now {next(v['start'] for v in p['current'] if v['n'] == f['fade'][-1])} s, on the bar line {f['start']} s" for f in p['fades']))
    finally: shutil.rmtree(tmp, ignore_errors=True)
    print('dry run: nothing written' if dry else 'done')


if __name__ == '__main__':
    main()
