#!/usr/bin/env python3
"""tools/experience/chapter-keys.py: keys are stable, a change to one chapter's camera changes only that key, a seed change
changes only the chapters that use it, a media change only its chapter, resolution / epoch change all, awaken follows
previews/awaken-v5-cut.json and hero shots/13-subshots.json, an overlay (freeze) file wins over the root's, and the Studio's
room state the render overlays (studio-state.json 'ergoflex.sceneAssets.v1', the chapter's room slice only; sceneLayers never)
changes exactly the chapters of that room, with an empty / missing / unreadable state stable. Runs on a tiny
synthetic film in a temp dir (no browser).     python3 tests/chapter-keys-test.py"""
import copy, importlib.util, json, os, shutil, tempfile
WT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('ck', f'{WT}/tools/experience/chapter-keys.py'); ck = importlib.util.module_from_spec(spec); spec.loader.exec_module(ck)
fails = []
def check(ok, what):
    print(('ok   ' if ok else 'FAIL ') + what)
    if not ok: fails.append(what)
IDS = ['awaken', 'rise', 'create', 'commons', 'coast', 'oilers', 'wellness', 'awareness', 'music', 'media', 'storage', 'hero']
HQ = 'exports/hq'
tmp = tempfile.mkdtemp(prefix='chapter-keys-test-')
def w(rel, o, root=tmp):
    p = os.path.join(root, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'wb' if isinstance(o, bytes) else 'w').write(o if isinstance(o, bytes) else json.dumps(o))
# the film's rooms as in hq14 review-cut.json (chapter 'music' is in the gaming room, 'media' in the music room)
ROOMS = {'awaken': ('product', None), 'rise': ('home', 'house'), 'create': ('creative', 'premium'), 'commons': ('library', 'humboldt'),
         'coast': ('occmedialab', 'house'), 'oilers': ('highschool', 'house'), 'wellness': ('gym', 'house'), 'awareness': ('product', None),
         'music': ('gaming', 'house'), 'media': ('music', 'house'), 'storage': ('workshop', 'house'), 'hero': ('product', None)}
def shot(i):
    s = {'id': IDS[i], 'seconds': 10 + i, 'camera': {'x': i, 'y': 1}, 'screens': {'main': 'clips/%02d.mp4' % i}, 'detail': 'text', 'note': 'n'}
    room, layout = ROOMS[IDS[i]]; s['room'] = room
    if layout: s['layout'] = layout
    return s
def build():
    w(f'{HQ}/review-cut.json', {'name': 'cut', 'shots': [shot(i) for i in range(12)]})
    w(f'{HQ}/previews/awaken-v5-cut.json', {'name': 'v5', 'shots': [shot(0)]})
    w(f'{HQ}/shots/13-subshots.json', {'name': 'sub', 'shots': [{**shot(11), 'sub': j} for j in range(6)]})
    for s in ('college', 'occ', 'finale'): w(f'{HQ}/post/{s}-seed.json', {'seed': s})
    for i in range(12): w('clips/%02d.mp4' % i, b'clip%d' % i)
def keys(res='4K', root=tmp, **kw): return {c: k for _, c, k in ck.chapter_keys(HQ, res, root, epoch='1', **kw)}
def changed(a, b): return sorted(c for c in a if a[c] != b[c])
try:
    build(); base = keys()
    check(len(base) == 12 and list(base) == IDS and all(len(k) == 64 for k in base.values()), 'twelve 64-hex keys in film order')
    check(keys() == base, 'stable across runs')
    check(len(set(base.values())) == 12, 'all keys differ')
    cut = json.load(open(f'{tmp}/{HQ}/review-cut.json')); cut['shots'][5]['camera']['x'] = 99; w(f'{HQ}/review-cut.json', cut)
    check(changed(base, keys()) == ['oilers'], 'one chapter\'s camera: only oilers changes (' + ','.join(changed(base, keys())) + ')')
    cut['name'] = 'renamed (render request)'; w(f'{HQ}/review-cut.json', cut); cur = keys()
    check(changed(base, cur) == ['oilers'], 'the cut\'s name is not part of the key')
    seed = json.load(open(f'{tmp}/{HQ}/post/college-seed.json')); seed['x'] = 1; w(f'{HQ}/post/college-seed.json', seed)
    check(changed(cur, keys()) == sorted(c for c in IDS if c not in ('coast', 'hero')), 'college seed: every chapter but coast and hero')
    w(f'{HQ}/post/occ-seed.json', {'seed': 'changed'}); k2 = keys(); w(f'{HQ}/post/finale-seed.json', {'seed': 'changed'})
    check(changed(k2, keys()) == ['hero'] and 'coast' in changed(cur, k2), 'occ seed -> coast, finale seed -> hero')
    k3 = keys(); w('clips/03.mp4', b'new clip')
    check(changed(k3, keys()) == ['commons'], 'a changed screens clip: only the chapter that shows it')
    k4 = keys(); os.remove(f'{tmp}/clips/04.mp4')
    check(changed(k4, keys()) == ['coast'], 'a missing clip is keyed as missing (no crash)')
    k5 = keys(); a4 = keys('1080p')
    check(all(a4[c] != k5[c] for c in IDS), 'resolution changes every key')
    e = {c: k for _, c, k in ck.chapter_keys(HQ, '4K', tmp, epoch='2')}
    check(all(e[c] != k5[c] for c in IDS), 'epoch changes every key')
    v5 = json.load(open(f'{tmp}/{HQ}/previews/awaken-v5-cut.json')); v5['shots'][0]['seconds'] = 44; w(f'{HQ}/previews/awaken-v5-cut.json', v5)
    check(changed(k5, keys()) == ['awaken'], 'awaken follows previews/awaken-v5-cut.json')
    k6 = keys(); sub = json.load(open(f'{tmp}/{HQ}/shots/13-subshots.json')); sub['shots'][5]['camera'] = {'x': 5}; w(f'{HQ}/shots/13-subshots.json', sub)
    check(changed(k6, keys()) == ['hero'], 'hero follows all of shots/13-subshots.json (last sub-shot)')
    # overlay (a freeze): its copy of review-cut.json wins, its manifest sha is used for media
    k7 = keys(); ov = tempfile.mkdtemp(prefix='ck-freeze-'); cut2 = copy.deepcopy(cut); cut2['shots'][1]['camera']['x'] = 7; w(f'{HQ}/review-cut.json', cut2, ov)
    check(changed(k7, keys(overlay=ov)) == ['rise'], 'overlay review-cut.json wins over the root\'s')
    open(f'{ov}/manifest.txt', 'w').write('# h\n' + '0' * 64 + ' 1 clips/02.mp4\n')
    check(changed(keys(overlay=ov), {**keys(overlay=ov)}) == [] and keys(overlay=ov)['create'] != k7['create'], 'overlay manifest sha is used for a media file')
    # per-chapter epoch: only that chapter's key moves
    real = ck.read_chapter_epochs; k8 = keys()
    try:
        ck.read_chapter_epochs = lambda d: {**real(d), 'rise': '9'}; k9 = keys()
    finally: ck.read_chapter_epochs = real
    check(changed(k8, k9) == ['rise'], 'a per-chapter epoch changes only that chapter\'s key')
    # ---- Studio room state the render overlays (--state-keys ergoflex.sceneAssets.v1 from studio-state.json): phase 5
    SA, SL = 'ergoflex.sceneAssets.v1', 'ergoflex.sceneLayers.v1'
    def state(assets=None, layers=None, raw=None, deleted=False, indent=None, root=tmp, crlf=False):
        ks = {}
        if assets is not None or raw is not None:
            ks[SA] = {'rev': 1, 'ts': 0, 'by': 't', **({'deleted': True} if deleted else {'value': raw if raw is not None else json.dumps(assets)})}
        if layers is not None: ks[SL] = {'rev': 1, 'ts': 0, 'by': 't', 'value': json.dumps(layers)}
        txt = json.dumps({'format': 'ergoflex-studio-state-v1', 'rev': 1, 'keys': ks}, indent=indent)
        w('studio-state.json', (txt.replace('\n', '\r\n') if crlf else txt).encode(), root)
    HS = 'highschool:house'; T1 = {'p': {'x': 1.25, 'y': 0, 'z': -2}, 'q': {'x': 0, 'y': 0, 'z': 0, 'w': 1}, 's': {'x': 1, 'y': 1, 'z': 1}}
    def room(removed=(), added=(), transforms=None): return {'removed': list(removed), 'added': list(added), 'transforms': transforms or {}}
    nostate = keys()
    state({}); check(keys() == nostate, 'an empty sceneAssets value = no studio-state.json at all (stable, no crash)')
    state({HS: room()}); check(keys() == nostate, 'an empty high school slice = an absent one')
    state({HS: room()}, raw='not json'); check(keys() == nostate, 'an unparseable value = empty (the render\'s JSON.parse fails the same way)')
    state(raw='x', deleted=True); check(keys() == nostate, 'a deleted record = absent (the render does not overlay it)')
    w('studio-state.json', b'{broken', tmp); check(keys() == nostate, 'an unreadable studio-state.json degrades to the absent value (no crash)')
    state({HS: room(transforms={'scene:highschool:house:room:24:bookshelf': T1})}); s1 = keys()
    check(changed(nostate, s1) == ['oilers'], 'a transform in the high school changes the oilers key and no other (' + ','.join(changed(nostate, s1)) + ')')
    T2 = copy.deepcopy(T1); T2['p']['x'] = 1.26; state({HS: room(transforms={'scene:highschool:house:room:24:bookshelf': T2})})
    check(changed(s1, keys()) == ['oilers'], 'a second move of the same prop changes oilers again')
    state({HS: room(transforms={'scene:highschool:house:room:24:bookshelf': T1}), 'library:humboldt': room(transforms={'scene:library:humboldt:room:3:x': T1})}); s2 = keys()
    check(changed(s1, s2) == ['commons'] and s2['oilers'] == s1['oilers'], 'a move in another room (library) changes nothing for oilers, only commons')
    state({HS: room(transforms={'scene:highschool:house:room:24:bookshelf': T1}), 'highschool:apartment': room(removed=['scene:a'])})
    check(changed(s1, keys()) == [], 'another layout of the same room (highschool:apartment) changes nothing')
    state({HS: room(transforms={'scene:highschool:house:room:24:bookshelf': T1}), 'music:house': room(removed=['scene:m'])})
    check(changed(s1, keys()) == ['media'], 'the music room\'s slice moves chapter media (its shot.room), not chapter music')
    state({HS: room(transforms={'scene:highschool:house:room:24:bookshelf': T1}), 'product': room(added=[{'editorId': 'scene:p1', 'propId': 'plant'}])})
    check(changed(s1, keys()) == ['awaken', 'awareness', 'hero'], 'the product stage\'s slice moves the product chapters (hero through its sub-shots)')
    state({HS: room(transforms={'scene:highschool:house:room:24:bookshelf': T1}), 'highschool': room(removed=['scene:b'])})
    check(changed(s1, keys()) == ['oilers'], 'a bare room entry (folded into a layout on load) counts for that room\'s chapters')
    BK = 'scene:highschool:house:room:24:ergoflex-small-bookshelf'
    state({HS: room(removed=[BK], transforms={'scene:highschool:house:room:24:bookshelf': T1})}); s3 = keys()
    check(changed(s1, s3) == ['oilers'], 'a removal in the high school changes only oilers')
    state({HS: room(removed=[BK, 'scene:z', BK], transforms={'scene:highschool:house:room:24:bookshelf': T1})}); s4 = keys()
    state({HS: room(removed=['scene:z', BK], transforms={'scene:highschool:house:room:24:bookshelf': T1})})
    check(changed(s3, s4) == ['oilers'] and keys() == s4, 'removed is a set: order and duplicates do not change a key')
    ADD = {'editorId': 'scene:highschool:house:add:1', 'propId': 'plant', 'position': [0, 0, 800]}
    state({HS: room(removed=[BK], added=[ADD], transforms={'scene:highschool:house:room:24:bookshelf': T1})}); s5 = keys()
    check(changed(s3, s5) == ['oilers'], 'an added item in the high school changes only oilers')
    state({HS: room(removed=[BK], added=[ADD, {'editorId': 'scene:x'}], transforms={'scene:highschool:house:room:24:bookshelf': T1})})
    check(keys() == s5, 'an added entry without propId (the render skips it) changes nothing')
    # same state, other spelling: key order, whitespace, CRLF, 1.0 vs 1, -0.0 vs 0
    v = {HS: {'transforms': {'scene:highschool:house:room:24:bookshelf': {'s': {'z': 1.0, 'y': 1, 'x': 1}, 'q': {'w': 1.0, 'z': -0.0, 'y': 0, 'x': 0}, 'p': {'z': -2.0, 'y': 0, 'x': 1.25}}},
              'added': [ADD], 'removed': [BK]}, 'zz:other': room()}
    state(raw=json.dumps(v, indent=3, sort_keys=False), indent=2, crlf=True)
    check(keys() == s5, 'the same state with other key order, whitespace, CRLF and float spelling gives the same keys')
    state({HS: room(removed=[BK], added=[ADD], transforms={'scene:highschool:house:room:24:bookshelf': T1})},
          layers={HS + '|' + BK: {'kind': 'prop', 'legacy': 'removed', 'cells': {'*/*': False}}, HS + '|desk:x': {'kind': 'desk', 'cells': {'morning/60x30': True}}})
    check(keys() == s5, 'a Studio show / hide (sceneLayers.v1) changes no key')
    # the freeze's studio-state.json wins over the root's (that is the copy the render PC renders with)
    ov2 = tempfile.mkdtemp(prefix='ck-freeze-'); state({}, root=ov2)
    check(keys(overlay=ov2) == nostate and keys() == s5, 'a freeze\'s studio-state.json is the one keyed, not the live one')
    shutil.rmtree(ov2, ignore_errors=True)
    # canonical form pinned (same bytes on every machine): what the key hashes for the oilers room
    got = ck.canon(ck.room_slices(json.loads(json.dumps(v)), [{'room': 'highschool', 'layout': 'house'}]))
    want = ('{"highschool:house":{"added":[{"editorId":"scene:highschool:house:add:1","position":[0,0,800],"propId":"plant"}],'
            '"removed":["scene:highschool:house:room:24:ergoflex-small-bookshelf"],"transforms":{"scene:highschool:house:room:24:bookshelf":'
            '{"p":{"x":1.25,"y":0,"z":-2},"q":{"w":1,"x":0,"y":0,"z":0},"s":{"x":1,"y":1,"z":1}}}}}')
    check(got == want, 'canonical room slice is pinned: ' + (got if got != want else 'ok'))
    check(ck.room_slices({}, [{'room': 'highschool', 'layout': 'house'}]) == {} and ck.room_slices({HS: None}, [{'room': 'highschool'}]) == {}, 'no state / null slice -> {}')
    check(set(ck.room_slices({'highschool:house': room(removed=['a']), 'highschool:wing': room(removed=['b']), 'high': room(removed=['c'])}, [{'room': 'highschool'}])) == {'highschool:house', 'highschool:wing'},
          'a shot without a layout takes every layout of its room (superset), never a prefix-alike room')
    os.remove(f'{tmp}/studio-state.json')
    # CLI
    import subprocess, sys
    r = subprocess.run([sys.executable, f'{WT}/tools/experience/chapter-keys.py', HQ, '--root', tmp, '--resolution', '720p', '--json', '--chapter', 'rise'], capture_output=True, text=True)
    j = json.loads(r.stdout) if r.returncode == 0 else {}
    check(j.get('resolution') == '720p' and list(j.get('keys', {})) == ['rise'] and j.get('epoch'), 'CLI --json --chapter: ' + (r.stderr.strip()[-200:] or json.dumps(j)[:80]))
    # the Director request carries force only for a film
    r = subprocess.run(['node', '--input-type=module', '-e', f"import {{makeRequest}} from '{WT}/experience/render-request.mjs';const b={{chapter:'rise',resolution:'4K',created:new Date(),signature:'s',estimate:1}};console.log(JSON.stringify([makeRequest({{...b,scope:'film',force:true}}).force,makeRequest({{...b,scope:'film'}}).force,makeRequest({{...b,scope:'chapter',force:true}}).force]))"], capture_output=True, text=True)
    check(r.stdout.strip() == '[true,null,null]', 'makeRequest: force:true only on a film request: ' + (r.stdout.strip() or r.stderr[-200:]))
finally:
    shutil.rmtree(tmp, ignore_errors=True)
print('FAILED: %d' % len(fails) if fails else 'all ok'); raise SystemExit(1 if fails else 0)
