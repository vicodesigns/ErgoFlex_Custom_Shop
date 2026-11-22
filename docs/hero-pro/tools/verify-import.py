# usage: python verify-import.py <control cut dir> <imported cut dir> [<render cut.json used for the after renders>]
# control = a scratch copy of the cut with the importer PASS run and no import (the pass alone already rewrites the hero's
# last renderRange from Vico's export, see README); imported = a scratch copy with the doc imported and the pass run.
# Prints every field that differs, per file / chapter / sub-shot, so the diff can be read as "only the intended hero fields";
# with a render cut, also checks that the rendered sub-shots equal the imported ones field by field.
import json, os, sys
c, i = sys.argv[1], sys.argv[2]
rc = sys.argv[3] if len(sys.argv) > 3 else None
ld = lambda p: json.load(open(p, encoding='utf-8'))
def files(d): return sorted(os.path.relpath(os.path.join(r, f), d).replace('\\', '/') for r, _, fs in os.walk(d) for f in fs)
fc, fi = files(c), files(i)
print('files only in one side:', sorted(set(fc) ^ set(fi)) or 'none')
diff = [f for f in fc if f in fi and open(os.path.join(c, f), 'rb').read() != open(os.path.join(i, f), 'rb').read()]
print('files that differ:', diff)
def fields(a, b, label):
    for k in sorted(set(a) | set(b)):
        if a.get(k) != b.get(k):
            sa, sb = json.dumps(a.get(k), ensure_ascii=False), json.dumps(b.get(k), ensure_ascii=False)
            print(f'  {label}.{k}: {sa[:110]}{"..." if len(sa) > 110 else ""}  ->  {sb[:110]}{"..." if len(sb) > 110 else ""}')
A, B = ld(os.path.join(c, 'review-cut.json')), ld(os.path.join(i, 'review-cut.json'))
for x, y in zip(A['shots'], B['shots']):
    if x != y: print(f'review-cut.json chapter {x["id"]}:'); fields(x, y, x['id'])
print('review-cut.json chapters unchanged:', [x['id'] for x, y in zip(A['shots'], B['shots']) if x == y])
A, B = ld(os.path.join(c, 'shots/13-subshots.json')), ld(os.path.join(i, 'shots/13-subshots.json'))
for x, y in zip(A['shots'], B['shots']):
    print(f'shots/13-subshots.json sub-shot {x["subshot"]} ({x["preset"]}):'); fields(x, y, x['subshot'])
A, B = ld(os.path.join(c, 'director-camera-hero.json')), ld(os.path.join(i, 'director-camera-hero.json'))
print('director-camera-hero.json:'); fields(A, B, 'dc')
if rc:
    R = ld(rc)
    bad = 0
    S = ld(os.path.join(i, 'shots/13-subshots.json'))['shots']
    for x, y in zip(S, R['shots']):
        for k in sorted(set(x) | set(y)):
            a, b = x.get(k), y.get(k)
            if k == 'camera':      # baked key labels ('·') differ only in how the Windows importer decodes them
                a = [{**q, 'label': ''} for q in a['keys']]; b = [{**q, 'label': ''} for q in b['keys']]
            if a != b: bad += 1; print(f'  RENDER MISMATCH sub-shot {x["subshot"]}.{k}')
    print('rendered sub-shots == imported sub-shots:', 'yes' if not bad else f'NO ({bad} fields)')
