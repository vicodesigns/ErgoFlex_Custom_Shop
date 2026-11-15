#!/usr/bin/env python3
"""Fail if the cine cut names a screen clip that is missing or too short (stream S6, Nov 14 2026).

    python exports/cinematic-intro-cut-cine/check-screens.py [--root <checkout>] [--freeze] [--only id,id]

For every `screens` entry of review-cut.json and of shots/13-subshots.json (the finale's six versions):
  - the file exists under the checkout (--root, default this one);
  - a video plays to the chapter's end: with loop false, duration >= seconds * rate + offset (one frame of slack), the
    clip would otherwise freeze on its last frame; a looping clip must simply be readable (duration > 0);
  - stills (png/jpg/webp) exist.
--freeze also fails a clip under exports/ that is not listed in tools/experience/freeze-lists/win-exports.txt (the list
that carries untracked exports to the Windows render PC: a missing clip made a render job loop, Nov 13-14).
Capture sidecars (<clip>.capture.json, written by capture.mjs): a clip whose recorded desk moves differ from its
chapter's in the cut now is STALE (re-capture it), and a music clip captured without the score's tempo map FAILS.
The cut's own 'hero' entry (cine-hero-home) is checked too, though the finale renders from the six versions in
shots/13-subshots.json; it is what a render of the cut's hero shot alone would show.
Prints one line per clip; exit status 1 on any failure. Needs ffprobe on PATH.
"""
import hashlib, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
STILL = ('.png', '.jpg', '.jpeg', '.webp')
_dur = {}


def duration(p):
    if p not in _dur:
        r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], capture_output=True, text=True)
        try: _dur[p] = float(r.stdout.strip())
        except ValueError: _dur[p] = None
    return _dur[p]


def _js(v):   # numbers as JavaScript writes them (2.0 -> 2), so the key matches capture.mjs's JSON.stringify
    if isinstance(v, float) and v.is_integer(): return int(v)
    if isinstance(v, dict): return {k: _js(x) for k, x in v.items()}
    if isinstance(v, list): return [_js(x) for x in v]
    return v


def motion_key(s):   # as capture.mjs records it: sha1 of {motion, seconds}, keys sorted, compact
    return hashlib.sha1(json.dumps(_js({'motion': s.get('motion'), 'seconds': s.get('seconds')}), sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()[:16]


def main():
    a = sys.argv[1:]
    root = os.path.abspath(a[a.index('--root') + 1]) if '--root' in a else REPO
    only = set(a[a.index('--only') + 1].split(',')) if '--only' in a else None
    listed = None
    if '--freeze' in a:
        listed = {l.strip() for l in open(os.path.join(REPO, 'tools/experience/freeze-lists/win-exports.txt'), encoding='utf-8') if l.strip() and not l.startswith('#')}
    load = lambda f: json.loads(open(f, 'rb').read().replace(b'\r\n', b'\n'))
    cut = load(os.path.join(HERE, 'review-cut.json'))['shots']
    shots = [(s['id'], s, None) for s in cut]
    byid = {s['id']: s for s in cut}
    # the finale's versions only play inside their sub-shot window (each version's 'subshot' letter in hero.subshots)
    hero = next((s for s in cut if s['id'] == 'hero'), {}); wins = hero.get('subshots') or {}
    sub = os.path.join(HERE, 'shots', '13-subshots.json')
    if os.path.exists(sub): shots += [(f"{s['id']}:{s.get('preset')}", s, wins.get(s.get('subshot'))) for s in load(sub)['shots']]
    bad = 0
    for sid, s, win in shots:
        if only and sid.split(':')[0] not in only: continue
        secs = float(win[1] if win else s.get('seconds') or 0)
        for sc in s.get('screens') or []:
            src = sc.get('src', ''); p = os.path.join(root, src); why = None
            if not os.path.isfile(p): why = 'MISSING'
            elif not src.lower().endswith(STILL):
                d = duration(p)
                if not d: why = 'unreadable'
                elif sc.get('loop') is False:
                    need = secs * float(sc.get('rate', 1)) + float(sc.get('offset') or 0)
                    if d + 1 / 30 < need: why = f'too short: {d:.2f} s < {need:.2f} s'
            if not why and listed is not None and src.startswith('exports/') and src not in listed: why = 'not in freeze-lists/win-exports.txt'
            car = os.path.splitext(p)[0] + '.capture.json'
            if not why and os.path.isfile(car):
                c = json.load(open(car, encoding='utf-8'))
                src_shot = byid.get(c.get('shot'), s)   # the chapter it was captured from (the finale reuses oilers' quiz)
                if c.get('motion') and c['motion'] != motion_key(src_shot): why = 'STALE: the desk moves changed since the capture (re-capture)'
                elif c.get('audio') and not c.get('tempo'): why = 'music captured without the score tempo map (fallback 115.2 BPM)'
            elif not why and sid == 'music' and '/cine-music-' in src: why = 'no capture sidecar: tempo unknown (re-capture)'
            d = _dur.get(p)
            print(f"{'FAIL' if why else 'ok  '} {sid:<18} {str(sc.get('target'))[:34]:<34} {src}" + (f'  [{d:.2f} s]' if d else '') + (f'  <- {why}' if why else ''))
            bad += bool(why)
    print(f'{bad} problem(s)' if bad else 'all screen clips present and long enough')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
