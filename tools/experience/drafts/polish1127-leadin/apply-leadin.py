#!/usr/bin/env python3
"""Chapter 12 (hero) data patch, polish1127-leadin: a Pearl White lead-in before the Artist desk.

    python3 tools/experience/drafts/polish1127-leadin/apply-leadin.py <cut folder> [--by 1.5]            dry run: reports
    python3 tools/experience/drafts/polish1127-leadin/apply-leadin.py <cut folder> [--by 1.5] --apply    writes

Vico (27 Nov 2026): the hero starts on a blank Pearl White desk (no accessories, no props, no screens) in the Artist desk's place
for the first second and a half, then goes into the Artist, Architect, Office, Gaming and the white ending as before.

Everything the chapter times is moved BY seconds later, the way the Director's group move does it, and the chapter grows by BY:
  camera        a held view for BY seconds, then the same moves (cameraPlan keys + the baked camera)
  desk moves    every clip's start (lift / tilt / wheels) + BY
  lights        the rig's keyed intensities / strengths (held at their first value for the first BY seconds)
  props         show.from / show.to (a prop shown 'from 0' stays 'from 0': it is there when its desk is), keyed opacities
  screens       each sub-shot's movie offset follows its desk's new window (desk-versions-edit.mjs resolveSubshots)
  finish fade   the sub-shots' finishFade.at + director-camera-hero.json finishFades
  titles        titles-src.json: the hero's titles and the end card + BY
  desk versions every desk + BY, and the blank Pearl White desk (look 'blank-pearl', letter I) from 0 s, the change to the Artist at BY
                (shown 0 - BY, the crossfade centred on it): list in director-camera-hero.json 'versions', the sub-shots
                (shots/13-subshots.json, director-film/hero-subshots.json) and the film shots' 'subshots' map
Not touched: the score (score-pins.json / score/), edl.json and the end card's film time: the music stays where it is, so every
picture event of the hero now lands BY seconds after the beat it was on (the opening bar is the Pearl White desk's). Re-fit the
score separately if the ending should stay on its hits.

Run it on a COPY of the cut (or the live one when Vico has said so). A second run reports 'already applied'.
"""
import copy, json, os, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
SPLINE = os.path.join(REPO, 'tools', 'experience', 'camera-spline.mjs')
HELPER = os.path.join(HERE, 'lead-in.mjs')
APPLY = os.path.join(REPO, 'tools', 'experience', 'desk-versions-apply.mjs')
r4 = lambda x: round(float(x) + 0.0, 4)
KEYED = ('intensity', 'strength', 'opacity')      # [[seconds, value], ...] fields of lights / sceneEdits


class Doc:
    """A JSON file written back in the format it was read in (the cut's files are not all formatted alike)."""
    def __init__(self, path):
        self.path = path; self.raw = open(path, encoding='utf-8', newline='').read(); self.data = json.loads(self.raw)
        self.ascii = '\\u' in self.raw
        m = re.match(r'^[\[{]\n( +)', self.raw); self.indent = len(m.group(1)) if m else None
        self.seps = None if self.indent is not None or '": ' in self.raw[:3000] or '", "' in self.raw[:3000] else (',', ':')
        if self.dumps() != self.raw: sys.exit(f'{path}: cannot write it back byte for byte; stopped before changing anything')
    def dumps(self, d=None):
        return json.dumps(self.data if d is None else d, ensure_ascii=self.ascii, indent=self.indent, separators=self.seps) + ('\n' if self.raw.endswith('\n') else '')
    def write(self):
        with open(self.path, 'w', encoding='utf-8', newline='') as f: f.write(self.dumps())


def run_node(script, payload):
    r = subprocess.run(['node', script], input=json.dumps(payload), capture_output=True, text=True)
    if r.returncode: sys.exit(f'{os.path.basename(script)}: {r.stderr.strip().splitlines()[-1] if r.stderr.strip() else r.returncode}')
    return json.loads(r.stdout)


def bake(seconds, plan):
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as t:
        json.dump({'seconds': seconds, 'cameraPlan': plan}, t); tmp = t.name
    try:
        subprocess.run(['node', SPLINE, tmp], check=True, stdout=subprocess.DEVNULL)
        return json.load(open(tmp))['camera']
    finally:
        os.unlink(tmp)


def shift_keyed(o, by):
    """Every keyed [[t, v], ...] under lights / sceneEdits, +by, held at its first value from 0."""
    n = 0
    if isinstance(o, dict):
        for k, v in o.items():
            if k in KEYED and isinstance(v, list) and v and all(isinstance(x, list) and len(x) == 2 and all(isinstance(y, (int, float)) for y in x) for x in v):
                first = v[0]; moved = [[r4(t + by), val] for t, val in v]
                o[k] = ([[0, first[1]]] + moved) if first[0] <= 1e-9 else moved; n += 1
            else: n += shift_keyed(v, by)
    elif isinstance(o, list):
        for x in o: n += shift_keyed(x, by)
    return n


def shift_show(e, by):
    """show {from, to, fadeIn, fadeOut}: 'from 0' stays (there from its desk's first frame), a later from and every to + by."""
    sh = e.get('show') if isinstance(e, dict) else None
    if not isinstance(sh, dict): return 0
    if isinstance(sh.get('from'), (int, float)) and sh['from'] > 1e-9: sh['from'] = r4(sh['from'] + by)
    if isinstance(sh.get('to'), (int, float)): sh['to'] = r4(sh['to'] + by)
    return 1


def shift_shot(s, by, plan, camera, new_T, keep_screens=False):
    s['seconds'] = new_T
    for c in (s.get('motion') or {}).get('clips') or []: c['start'] = r4(c['start'] + by)
    s['cameraPlan'] = copy.deepcopy(plan); s['camera'] = copy.deepcopy(camera)
    for l in s.get('lights') or []: shift_keyed(l, by)
    for e in s.get('sceneEdits') or []:
        shift_keyed(e, by); shift_show(e, by)
    if not keep_screens:
        for sc in s.get('screens') or []:
            if isinstance(sc.get('offset'), (int, float)): sc['offset'] = r4(sc['offset'] - by)
    ff = s.get('finishFade')
    if isinstance(ff, dict) and isinstance(ff.get('at'), list): ff['at'] = [r4(t + by) for t in ff['at']]
    for e in s.get('ledStatus') or []:
        if isinstance(e, dict) and isinstance(e.get('at'), (int, float)): e['at'] = r4(e['at'] + by)
    return s


def main():
    args = sys.argv[1:]; apply_ = '--apply' in args
    by = 1.5
    if '--by' in args: i = args.index('--by'); by = float(args[i + 1]); del args[i:i + 2]
    args = [a for a in args if not a.startswith('--')]
    if len(args) != 1: sys.exit(__doc__)
    H = args[0]; P = lambda *a: os.path.join(H, *a)
    cut = Doc(P('review-cut.json')); main_ = next(s for s in cut.data['shots'] if s['id'] == 'hero')
    dcd = Doc(P('director-camera-hero.json')); dc = dcd.data
    sub13 = Doc(P('shots', '13-subshots.json')); subD = Doc(P('director-film', 'hero-subshots.json')); filmD = Doc(P('director-film', 'hero.json'))
    titles = Doc(P('titles-src.json'))
    old_T = float(main_['seconds']); new_T = round(old_T + by, 3)
    if any(v.get('look') == 'blank-pearl' for v in dc.get('versions') or []) or any(s.get('deskLook') for s in sub13.data['shots']):
        print('hero: lead-in already applied (a blank Pearl White desk is in the chapter): nothing to do'); return
    if abs(float(dc['seconds']) - old_T) > 1e-6: sys.exit(f'director-camera-hero.json is {dc["seconds"]} s, review-cut.json {old_T} s: import first')
    print(f'hero: {old_T} -> {new_T} s (+{by}), blank Pearl White desk 0 - {by} s, then the Artist')
    # ---- the camera: a held view for `by`, then the same moves
    plan = copy.deepcopy(main_['cameraPlan']); keys = plan['keys']
    for k in keys: k['at'] = r4(k['at'] + by)
    hold = {**{k: v for k, v in copy.deepcopy(keys[0]).items() if k != 'hold'}, 'at': 0, 'label': 'Lead-in hold (Pearl White opener)'}
    plan['keys'] = [hold] + keys
    camera = bake(new_T, plan)
    # ---- desk versions
    versions = dc['versions']
    used = [s.get('subshot') for s in sub13.data['shots']] + list((main_.get('subshots') or {}).keys())
    new_versions = run_node(HELPER, {'versions': versions, 'by': by, 'total': new_T, 'look': 'blank-pearl', 'used': used})
    print('  desks: ' + ' | '.join(f'{v["n"]}={v["preset"]}{"*" if v.get("look") else ""} {v["start"]}-{v["end"]}' for v in new_versions) + '   (* blank Pearl White)')
    # ---- the film shots (review-cut.json hero, director-film/hero.json): everything shifted; the subshots map / presets from the list
    for shot in (main_, filmD.data): shift_shot(shot, by, plan, camera, new_T)
    # ---- the sub-shots: each existing one shifted (their screens follow their windows in the pass), then the pass adds the blank desk
    for doc in (sub13, subD):
        shots = [s for s in doc.data['shots'] if s.get('id') == 'hero']
        for s in shots: shift_shot(s, by, plan, camera, new_T, keep_screens=True)
        out = run_node(APPLY, {'subshots': shots, 'versions': new_versions, 'library': dc.get('versionLibrary') or doc.data.get('library') or []})
        assert len(shots) == len(doc.data['shots']), f'{doc.path}: sub-shots of another chapter in the file'
        doc.data['shots'] = out['subshots']
        for s in doc.data['shots']: s['seconds'] = new_T
        film = out['film']
    for shot in (main_, filmD.data):
        shot['subshots'] = copy.deepcopy(film['subshots']); shot['presets'] = list(film['presets'])
    # ---- director-camera-hero.json
    dc['seconds'] = new_T if new_T != int(new_T) else int(new_T)
    dc['keys'] = copy.deepcopy(plan['keys'])
    for c in dc.get('clips') or []: c['start'] = r4(c['start'] + by)
    for p in dc.get('props') or []: shift_show(p, by)
    for n, f in (dc.get('finishFades') or {}).items():
        f['at'] = [r4(t + by) for t in f['at']]; shift_keyed(f.get('set') or {}, by)
    dc['versions'] = new_versions
    # ---- titles
    n_titles = 0
    for t in titles.data['titles'] + [titles.data.get('cta') or {}, titles.data.get('logo') or {}]:
        if t.get('chapter') != 'hero': continue
        for k in ('rel_in', 'rel_out'):
            if isinstance(t.get(k), (int, float)): t[k] = r4(t[k] + by); n_titles += 1
    print(f'  titles: {n_titles} times +{by}; camera {len(camera["keys"])} keys (hold 0 - {by} s); clips {len(dc.get("clips") or [])}; props {len(dc.get("props") or [])}')
    # ---- the held camera really holds, and the moves are the old moves later
    k0 = camera['keys'][0]['view']['position']
    at = lambda t: min(camera['keys'], key=lambda k: abs(k['time'] * new_T - t))['view']['position']
    assert max(abs(a - b) for a, b in zip(at(by * .9), k0)) < 1e-3, 'the camera does not hold during the lead-in'
    if not apply_: print('dry run: nothing written (add --apply)'); return
    for d in (cut, dcd, sub13, subD, filmD, titles): d.write()
    print('written: review-cut.json director-camera-hero.json shots/13-subshots.json director-film/hero-subshots.json director-film/hero.json titles-src.json')


if __name__ == '__main__': main()
