"""Compares two copies of a cut folder file by file: JSON files by value (every differing path), other text files with line
endings ignored, binaries by bytes. Files only in one copy are listed.
  compare-trees.py <cut dir A> <cut dir B> [--max N]   (N differing paths shown per file, default 12)
Exit 0 when equal."""
import json, os, sys
a, b = sys.argv[1], sys.argv[2]
mx = int(sys.argv[sys.argv.index('--max') + 1]) if '--max' in sys.argv else 12
def files(root):
    out = set()
    for d, _, fs in os.walk(root):
        for f in fs: out.add(os.path.relpath(os.path.join(d, f), root).replace(os.sep, '/'))
    return out
def walk(x, y, p, out):
    if x == y: return
    if isinstance(x, (int, float)) and isinstance(y, (int, float)) and not isinstance(x, bool) and abs(x - y) < 1e-9: return
    if isinstance(x, dict) and isinstance(y, dict):
        for k in sorted(set(x) | set(y), key=str): walk(x.get(k, '<absent>'), y.get(k, '<absent>'), p + '/' + str(k), out)
    elif isinstance(x, list) and isinstance(y, list) and len(x) == len(y):
        for i, (u, v) in enumerate(zip(x, y)): walk(u, v, p + '/' + str(i), out)
    else: out.append(p + ': ' + json.dumps(x)[:70] + ' | ' + json.dumps(y)[:70])
fa, fb = files(a), files(b); bad = 0
for f in sorted(fa - fb): print('only in A:', f); bad += 1
for f in sorted(fb - fa): print('only in B:', f); bad += 1
for f in sorted(fa & fb):
    ra, rb = open(os.path.join(a, f), 'rb').read(), open(os.path.join(b, f), 'rb').read()
    if ra == rb: continue
    if f.endswith('.json'):
        try: x, y = json.loads(ra.decode('utf-8')), json.loads(rb.decode('utf-8'))
        except Exception as e: print(f, 'unparsable', e); bad += 1; continue
        out = []; walk(x, y, '', out)
        if out: bad += 1; print(f'{f}: {len(out)} difference(s)'); [print('   ', o) for o in out[:mx]]
    elif ra.replace(b'\r\n', b'\n') != rb.replace(b'\r\n', b'\n'):
        bad += 1; la, lb = ra.replace(b'\r\n', b'\n').split(b'\n'), rb.replace(b'\r\n', b'\n').split(b'\n')
        dl = [i for i in range(max(len(la), len(lb))) if (la[i] if i < len(la) else None) != (lb[i] if i < len(lb) else None)]
        print(f'{f}: {len(dl)} differing line(s)', *(f'\n    line {i + 1}: {(la[i] if i < len(la) else b"")[:90]!r} | {(lb[i] if i < len(lb) else b"")[:90]!r}' for i in dl[:3]))
print('equal' if not bad else f'{bad} file(s) differ'); sys.exit(1 if bad else 0)
