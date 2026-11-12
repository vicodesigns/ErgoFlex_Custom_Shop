#!/usr/bin/env python3
"""tools/experience/chapter-keys.py: keys are stable, a change to one chapter's camera changes only that key, a seed change
changes only the chapters that use it, a media change only its chapter, resolution / epoch change all, awaken follows
previews/awaken-v5-cut.json and hero shots/13-subshots.json, an overlay (freeze) file wins over the root's. Runs on a tiny
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
def shot(i): return {'id': IDS[i], 'seconds': 10 + i, 'camera': {'x': i, 'y': 1}, 'screens': {'main': 'clips/%02d.mp4' % i}, 'detail': 'text', 'note': 'n'}
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
