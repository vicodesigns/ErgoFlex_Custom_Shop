#!/usr/bin/env python3
"""The cine cut's screens (stream S6, Nov 14 2026): point each chapter's monitors at its own clips.

    python exports/cinematic-intro-cut-cine/build-screens.py [--only id,id] [--dry-run]

Every chapter is opt-in: with no --only, only OWNED_LANDED is written (S6's own chapters and those whose owner has
landed, extended when the coordinator says so); --only writes exactly the chapters named.

Writes ONLY the `screens` field of review-cut.json's chapters (and the hero versions' `screens` in shots/13-subshots.json),
so it lands after each chapter's owner and can be re-run at any time (values are absolute: re-runs change nothing).
Every clip is captured by tools/experience/screens/capture.mjs (clips.mjs, the `cine-*` entries) into
exports/cinematic-intro-cut-cine/screens/, is chapter seconds + 1 s long and plays at offset 0 with loop false; a
monitor's brightness / blend carry over from the entry it replaces. Targets not named here keep their clip (rise's
phone on the charger, music's game montage, media's movie). Proposal: docs/cine-screens-20261114/SCREENS-PROPOSAL.md.
media keeps its film.
Check after a capture: python exports/cinematic-intro-cut-cine/check-screens.py
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
CUT = os.environ.get('SCREENS_CUT') or os.path.join(HERE, 'review-cut.json')            # (env: the test runs on copies)
SUB = os.environ.get('SCREENS_SUB') or os.path.join(HERE, 'shots', '13-subshots.json')
SCR = 'exports/cinematic-intro-cut-cine/screens/'

# chapter -> {target: clip id}; 'texture' entries are film texture targets (tools/experience/film-texture-screens.mjs)
PLAN = {
    'awaken': {'main-landscape': 'cine-awaken-main'},
    'rise': {'main-landscape': 'cine-rise-curved', 'main-portrait': 'cine-rise-portrait', 'phone': 'cine-rise-phone'},
    'create': {'main-landscape': 'cine-create-landscape', 'main-portrait': 'cine-create-portrait'},
    'commons': {'main-landscape': 'cine-commons-reservation'},
    'oilers': {'main-landscape': 'cine-oilers-curved', 'main-portrait': 'cine-oilers-portrait', 'main-landscape-2': 'cine-oilers-laptop'},
    'wellness': {'main-landscape': 'cine-wellness-main', 'tablet': 'cine-wellness-tablet'},
    'awareness': {'main-landscape': 'cine-awareness-main'},
    'music': {'arcade': 'cine-music-arcade', 'marquee': 'cine-music-marquee', 'tv': 'cine-music-tv',
              'atelier-gaming-streamdeck-cyber/gaming-macro-key-display': 'cine-music-streamdeck'},
    'hero': {'main-landscape': 'cine-hero-home'},
    'coast': {'main-landscape': 'cine-coast-main', 'ergoflex-wide-monitor/monitor-screen': 'cine-coast-curved',
              'ergoflex-portrait-monitor/monitor-screen': 'cine-coast-portrait', 'occ-display': 'cine-coast-wall'},
}
# chapters written by a run without --only: S6's own (storage, hero) and those whose owner has landed (coast: S4)
OWNED_LANDED = {'storage', 'hero', 'coast'}
TEXTURES = {
    # the drafting board's paper, relabelled as a home (a still: the same plan as the left monitor and the 3D house);
    # within 'desk': only the featured desk's kit (another drafting kit in the room keeps its sheet)
    'create': [{'target': 'texture', 'mesh': '^Architect floor plan$', 'within': 'desk', 'src': SCR + 'cine-create-floor-plan.png'}],
    # the phone in Andre's hand (every phone posture of his is its own GLB; all of them show the clip)
    'storage': [{'target': 'texture', 'material': '^Held\\.phone screen', 'person': 'andre', 'src': SCR + 'cine-storage-phone.mp4', 'offset': 0, 'loop': False}],
}
HERO_VERSIONS = {'gaming': {'main-landscape': 'cine-hero-gaming'}, 'artist': {'main-landscape': 'cine-hero-artist'},
                 # hbhs: its portrait plays oilers' own quiz (Kai's chapter) at the version's offset (-20.3: the votes,
                 # clip 1.0-7.4 s, before the lowering overlay at 7.8 s)
                 'hbhs': {'main-landscape': 'cine-hero-hbhs', 'main-portrait': 'cine-oilers-portrait'}, 'occ': {'main-landscape': 'cine-hero-occ'},
                 # the analyst's clips keep their offset (-13.1: local clip time from the version's start) and are 10 s now
                 'office': {'main-landscape': 'cine-hero-office-wide', 'main-portrait': 'cine-hero-office-portrait'}}
KEEP_OFFSET = {'office': ('main-landscape', 'main-portrait'), 'hbhs': ('main-portrait',)}   # windowed clips keep their offset
CARRY = ('brightness', 'blend', 'fit', 'inset', 'rotate', 'flipX', 'res')


def entry(target, clip, was=None):
    e = {'target': target, 'src': SCR + clip + '.mp4', 'offset': 0, 'loop': False}
    for k in CARRY:
        if was and k in was: e[k] = was[k]
    return e


def screens_for(cid, old):
    plan, out, seen = PLAN.get(cid, {}), [], set()
    for sc in old or []:
        if sc.get('target') == 'texture': continue          # ours: rewritten below
        t = sc.get('target')
        if t in plan: out.append(entry(t, plan[t], sc)); seen.add(t)
        else: out.append(sc)
    for t, clip in plan.items():
        if t not in seen: out.append(entry(t, clip))
    out += [dict(e) for e in TEXTURES.get(cid, [])]
    return out


def main():
    args = sys.argv[1:]
    only = set(args[args.index('--only') + 1].split(',')) if '--only' in args else None
    dry = '--dry-run' in args
    cut = json.loads(open(CUT, 'rb').read().replace(b'\r\n', b'\n'))
    changed = []
    for s in cut['shots']:
        cid = s['id']
        if cid not in PLAN and cid not in TEXTURES: continue
        if only and cid not in only: continue
        if not only and cid not in OWNED_LANDED: continue
        new = screens_for(cid, s.get('screens'))
        if new != s.get('screens'): changed.append(cid); s['screens'] = new
    sub = json.loads(open(SUB, 'rb').read().replace(b'\r\n', b'\n'))
    if not only or 'hero' in only:
        for v in sub['shots']:
            plan = HERO_VERSIONS.get(v.get('preset'))
            if not plan: continue
            old = v.get('screens') or []
            new = [{**entry(sc['target'], plan[sc['target']], sc), **({'offset': sc['offset']} if v.get('preset') in KEEP_OFFSET and 'offset' in sc and sc['target'] in KEEP_OFFSET[v['preset']] else {})}
                   if sc.get('target') in plan else sc for sc in old]
            if new != old: changed.append('hero:' + v['preset']); v['screens'] = new
    for c in changed: print('screens:', c)
    if dry or not changed: print('(nothing written)' if not changed else '(dry run)'); return
    open(CUT, 'w', encoding='utf-8', newline='\n').write(json.dumps(cut, indent=1))
    open(SUB, 'w', encoding='utf-8', newline='\n').write(json.dumps(sub))


if __name__ == '__main__':
    main()
