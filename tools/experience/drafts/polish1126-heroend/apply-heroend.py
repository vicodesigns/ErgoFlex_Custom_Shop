#!/usr/bin/env python3
"""Chapter 12 (hero) data patch, polish1126: the office desk comes in level, and the ending turns pearl white.

    python3 tools/experience/drafts/polish1126-heroend/apply-heroend.py <cut folder>            dry run: lists before / after
    python3 tools/experience/drafts/polish1126-heroend/apply-heroend.py --apply <cut folder>    writes

Apply to a COPY of the cut. Run polish1126-heroprops/apply-heroprops.py first (this script does not depend on it).
Needs this branch's render-cut.cjs + finish-fade.cjs (shot.finishFade) and finish-intro.py (logo.show_delay).
It edits shots/13-subshots.json and titles-src.json. A second run reports 0 changes. A value that is neither the old nor
the new one stops the script before anything is written (the cut is not the one this patch was made for).

OFFICE (sub-shot D, 9.34-17.08 s, chapter seconds). Its desk opened tilted 30 deg, so keyboard, mouse and desktop items
started auto-stowed on the shelf and cross-faded to the desk at 11.58 s. In D only (its own copy of the motion):
  c-tilt 10.1 s + 2.3 s -> 7.6 s + 1.2 s, so the desk is level (-5 deg) and the hand-off is over before D's first frame.
  The office items' own fade-in (0.3 s after the desk comes in) goes: they are on from D's first frame and come in with
  the cross-dissolve from the architect desk. Fade-outs, lift and camera unchanged.

ENDING (sub-shot H, 15.08-25.95 s).
  The gaming desk's monitor, keyboard, mouse, trays: gone at 19.30 s (were 20.57 s), the same 0.55 s fade.
  finishFade 19.20 -> 20.45 s: black / red trim -> Pearl White wood, White frame, White trim (the library's
  'Pearl-white growing workspace' finish, room-desk-styles.mjs). It is nearly complete on the score's logo hit (20.37 s,
  film 244.64 s). The white look has its own softer, warm-white lights, LED colour and exposure so the white is not
  blown out and nothing stays red.
  Wordmark: titles-src logo.show_delay = 1.0 (picture only: rel_in 20.37 stays, so the score does not change).
  CTA: rel_in 21.43 -> 22.23. Film length unchanged.
"""
import copy, json, os, sys

C_TILT = (dict(start=10.1, duration=2.3), dict(start=7.6, duration=1.2))
GAMING_TO = (5.49, 4.22)          # seconds after sub-shot H starts (15.08): fade 18.75 -> 19.30
FADE_AT = [19.2, 20.45]
WHITE = dict(wood='Pearl White', base='White', trim='#f5f5f2')
LOGO_DELAY = 1.0
CTA_REL_IN = (21.43, 22.23)
# the white look's lights (the black desk's rim lights, 170 -> 260 into the end, blow a white desk out)
LIGHTS = dict(key=11, rimLeft=34, rimRight=34, kicker=7, frontLow=1.8, pool=0.3)
EXPOSURE, LED_COLOR, LED_GLOW = 0.57, '#fff6ea', 0.06


class Patch:
    def __init__(self):
        self.changes = []

    def set(self, where, obj, key, old, new):
        """obj[key]: old -> new. old / new None = absent."""
        cur = obj.get(key)
        if cur == new:
            return
        if cur != old:
            sys.exit(f'STOP {where}: expected {old!r} (or already {new!r}), found {cur!r}; nothing written')
        self.changes.append(f'{where}: {json.dumps(old)} -> {json.dumps(new)}')
        if new is None:
            del obj[key]
        else:
            obj[key] = new


def white_look(h):
    lights = copy.deepcopy(h['lights'])
    rig = lights[0]
    assert rig.get('preset') == 'productRig', 'H lights[0] is not the product rig'
    for k in ('key', 'rimLeft', 'rimRight'):
        rig[k]['intensity'] = LIGHTS[k]
    rig['pool']['strength'] = LIGHTS['pool']
    for light in lights[1:]:
        if light.get('name') in LIGHTS:
            light['intensity'] = LIGHTS[light['name']]
    return dict(deskFinish=WHITE, ledColor=LED_COLOR, ledGlow=LED_GLOW,
                sceneGlobals={**h.get('sceneGlobals', {}), 'exposure': EXPOSURE}, lights=lights)


def patch_subshots(p, cut):
    shots = {s.get('subshot'): s for s in cut['shots']}
    d, h = shots['D'], shots['H']
    assert d['preset'] == 'office' and h['preset'] == 'gaming'
    clip = next(c for c in d['motion']['clips'] if c['id'] == 'c-tilt')
    for k in ('start', 'duration'):
        p.set(f'D motion c-tilt {k}', clip, k, C_TILT[0][k], C_TILT[1][k])
    n = 0
    for e in d['sceneEdits']:
        w = e.get('show')
        if e.get('desk') != 'office' or not w:
            continue
        n += 1
        name = e.get('label') or e['match']
        if w.get('from') != 0:
            p.set(f'D {name} show.from', w, 'from', 0.3, 0)
        if 'fadeIn' in w:
            p.set(f'D {name} show.fadeIn', w, 'fadeIn', 0.25, None)
    assert n >= 20, f'only {n} timed office items in D'
    n = 0
    for e in h['sceneEdits']:
        if e.get('desk') == 'gaming' and e.get('show'):
            n += 1
            p.set(f"H {e.get('label') or e['match']} show.to", e['show'], 'to', *GAMING_TO)
    assert n == 6, f'expected the 6 gaming items in H, found {n}'
    fade = dict(at=FADE_AT, set=white_look(h))
    if h.get('finishFade') != fade:
        if h.get('finishFade') is not None:
            sys.exit('STOP H finishFade is there with other values; nothing written')
        p.changes.append(f'H finishFade: none -> {json.dumps(fade)}')
        h['finishFade'] = fade


def patch_titles(p, src):
    logo, cta = src['logo'], src['cta']
    assert logo['chapter'] == 'hero' and abs(logo['rel_in'] - 20.37) < 1e-6, 'logo rel_in is not 20.37'
    p.set('titles-src logo.show_delay', logo, 'show_delay', None, LOGO_DELAY)
    p.set('titles-src cta.rel_in', cta, 'rel_in', *CTA_REL_IN)


def main():
    apply = '--apply' in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) != 1:
        sys.exit(__doc__)
    p, out = Patch(), []
    for rel, fn in (('shots/13-subshots.json', patch_subshots), ('titles-src.json', patch_titles)):
        path = os.path.join(args[0], rel)
        raw = open(path, 'rb').read()
        data = json.loads(raw.decode('utf-8'))
        before = len(p.changes)
        fn(p, data)
        if len(p.changes) > before:
            indent = 1 if raw.lstrip().startswith(b'{\n ') or raw.lstrip().startswith(b'{\r\n ') else None
            text = json.dumps(data, ensure_ascii=False, indent=indent, separators=None if indent else (',', ':'))
            out.append((path, text.encode('utf-8')))
    for line in p.changes:
        print('  ' + line)
    if apply:
        for path, text in out:
            with open(path + '.part', 'wb') as f:
                f.write(text)
            os.replace(path + '.part', path)
    print(f"{'applied' if apply else 'dry run'}: {len(p.changes)} change(s)")


if __name__ == '__main__':
    main()
