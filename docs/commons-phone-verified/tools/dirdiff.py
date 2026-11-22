"""dirdiff.py <base cut dir> <new cut dir>: every changed file; json files diffed structurally (review-cut.json per chapter)."""
import json,sys,os,hashlib
sys.path.insert(0,'C:/work/cphone/tools')
from jdiff import diff
A,B=sys.argv[1:3]
def files(r):
    out=set()
    for d,_,fs in os.walk(r):
        for f in fs: out.add(os.path.relpath(os.path.join(d,f),r).replace('\\','/'))
    return out
fa,fb=files(A),files(B)
def h(p): return hashlib.sha256(open(p,'rb').read()).hexdigest()
for f in sorted(fa-fb): print('FILE REMOVED',f)
for f in sorted(fb-fa): print('FILE ADDED',f)
for f in sorted(fa&fb):
    pa,pb=os.path.join(A,f),os.path.join(B,f)
    if h(pa)==h(pb): continue
    if not f.endswith('.json'): print('FILE CHANGED (binary/text)',f); continue
    a=json.load(open(pa,encoding='utf8')); b=json.load(open(pb,encoding='utf8'))
    if a==b: print('FILE CHANGED (format only, same JSON)',f); continue
    print('FILE CHANGED',f)
    if isinstance(a,dict) and 'shots' in a and isinstance(b,dict) and 'shots' in b:
        ida=[s.get('id') for s in a['shots']]; idb=[s.get('id') for s in b['shots']]
        if ida!=idb: print('  chapter list changed',ida,idb)
        for sa,sb in zip(a['shots'],b['shots']):
            d=diff(sa,sb)
            print(f'  chapter {sa.get("id")}: {len(d)} differences')
            for l in d: print('    '+l[:300])
        rest=diff({k:v for k,v in a.items() if k!='shots'},{k:v for k,v in b.items() if k!='shots'})
        for l in rest: print('  top '+l[:300])
    else:
        for l in diff(a,b): print('  '+l[:300])
