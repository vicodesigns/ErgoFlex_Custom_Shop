#!/usr/bin/env python3
"""Show / hide (scene-layers.mjs) and the film's chapter keys (tools/experience/chapter-keys.py).
A Studio hide lives in 'ergoflex.sceneLayers.v1' in studio-state.json: the film never reads it, so a change to it must
not change any chapter key. A chapter's own hide (the Director's, in the cut shot) must change only that chapter's key.
The former known hole (DESIGN.md 5.3) is closed by phase 5 (render epoch 3 -> 4): the renders' --state-keys overlay of
'ergoflex.sceneAssets.v1' is now in the key (the chapter's room slice), so a Studio move or removal in the high school
changes the oilers key, and only that one. This check was flipped on purpose when phase 5 landed.
Tiny synthetic film in a temp dir, no browser.     python tests/chapter-keys-layers-test.py"""
import importlib.util, json, os, shutil, tempfile
WT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('ck', f'{WT}/tools/experience/chapter-keys.py'); ck = importlib.util.module_from_spec(spec); spec.loader.exec_module(ck)
fails = []
def check(ok, what):
    print(('ok   ' if ok else 'FAIL ') + what)
    if not ok: fails.append(what)
IDS = ['awaken', 'rise', 'create', 'commons', 'coast', 'oilers', 'wellness', 'awareness', 'music', 'media', 'storage', 'hero']
HQ = 'exports/hq'
tmp = tempfile.mkdtemp(prefix='chapter-keys-layers-')
def w(rel, o):
    p = os.path.join(tmp, rel); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'w').write(json.dumps(o))
def shot(i):
    s = {'id': IDS[i], 'seconds': 10 + i, 'camera': {'x': i}}
    if IDS[i] == 'oilers': s.update(room='highschool', layout='house', mode='morning', size='60x30', sceneEdits=[])
    return s
def state(layers, assets):
    keys = {'ergoflex.sceneLayers.v1': {'rev': 1, 'ts': 0, 'by': 't', 'value': json.dumps(layers)},
            'ergoflex.sceneAssets.v1': {'rev': 1, 'ts': 0, 'by': 't', 'value': json.dumps(assets)}}
    w('studio-state.json', {'format': 'ergoflex-studio-state-v1', 'rev': 1, 'keys': keys})
def keys(): return {c: k for _, c, k in ck.chapter_keys(HQ, '4K', tmp, epoch='1')}
def changed(a, b): return sorted(c for c in a if a[c] != b[c])
try:
    cut = {'name': 'cut', 'shots': [shot(i) for i in range(12)]}
    w(f'{HQ}/review-cut.json', cut); w(f'{HQ}/previews/awaken-v5-cut.json', {'shots': [shot(0)]}); w(f'{HQ}/shots/13-subshots.json', {'shots': [shot(11)]})
    for s in ('college', 'occ', 'finale'): w(f'{HQ}/post/{s}-seed.json', {'seed': s})
    BK = 'scene:highschool:house:room:24:ergoflex-small-bookshelf'
    state({}, {'highschool:house': {'removed': [BK], 'added': [], 'transforms': {}}}); base = keys()
    state({'highschool:house|desk:station-research-desk': {'kind': 'desk', 'cells': {'morning/60x30': True}},
           'highschool:house|' + BK: {'kind': 'prop', 'legacy': 'removed', 'cells': {'*/*': False}}},
          {'highschool:house': {'removed': [BK], 'added': [], 'transforms': {}}})
    check(changed(base, keys()) == [], 'a Studio hide or show (sceneLayers.v1) changes no chapter key')
    state({}, {'highschool:house': {'removed': [], 'added': [], 'transforms': {BK: {'p': {'x': 1}}}}})
    check(changed(base, keys()) == ['oilers'], 'phase 5 (was the known hole): a Studio sceneAssets move or removal in the high school changes the oilers key and no other')
    state({}, {'highschool:house': {'removed': [BK], 'added': [], 'transforms': {}}, 'library:humboldt': {'removed': ['scene:x'], 'added': [], 'transforms': {}}})
    check(changed(base, keys()) == [], 'a sceneAssets change in a room no chapter of this film uses changes no key')
    state({}, {'highschool:house': {'removed': [BK], 'added': [], 'transforms': {}}})
    cut['shots'][5]['sceneEdits'] = [{'match': '^Prop:ergoflex-small-bookshelf$', 'asset': BK[6:], 'hide': True, 'director': True}]; w(f'{HQ}/review-cut.json', cut)
    check(changed(base, keys()) == ['oilers'], 'a chapter\'s own hide edit changes only that chapter\'s key')
    cut['shots'][5]['sceneDeskEdits'] = [{'desk': 'station-research-desk', 'hide': True}]; k1 = keys(); w(f'{HQ}/review-cut.json', cut)
    check(changed(k1, keys()) == ['oilers'], 'a chapter desk hide (phase 4 field) changes only that chapter\'s key')
finally:
    shutil.rmtree(tmp, ignore_errors=True)
print('FAILED: ' + '; '.join(fails) if fails else 'chapter keys and layers: all checks pass')
raise SystemExit(1 if fails else 0)
