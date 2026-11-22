"""chapdiff.py <base cut dir> <new cut dir> [chapter=commons]: the chapter's diff with sceneEdits compared as a sequence
(difflib on the entries' JSON), people cast by key, and every other chapter / top-level field checked for equality."""
import json,sys,difflib
sys.path.insert(0,'C:/work/cphone/tools')
from jdiff import diff
A,B=sys.argv[1:3]; CH=sys.argv[3] if len(sys.argv)>3 else 'commons'
a=json.load(open(A+'/review-cut.json',encoding='utf8')); b=json.load(open(B+'/review-cut.json',encoding='utf8'))
print('top-level (non-shot) fields equal:',{k:v for k,v in a.items() if k!='shots'}=={k:v for k,v in b.items() if k!='shots'})
for sa,sb in zip(a['shots'],b['shots']):
    if sa['id']!=CH: print(f'chapter {sa["id"]}: {"IDENTICAL" if sa==sb else "CHANGED: "+str(len(diff(sa,sb)))+" differences"}')
sa=next(s for s in a['shots'] if s['id']==CH); sb=next(s for s in b['shots'] if s['id']==CH)
print(f'=== chapter {CH}')
for k in sorted(set(sa)|set(sb)):
    if k in ('sceneEdits','people'): continue
    if sa.get(k)!=sb.get(k):
        for l in diff({k:sa.get(k)},{k:sb.get(k)}): print('  '+l[:260])
ea=[json.dumps(e,sort_keys=True,ensure_ascii=False) for e in sa.get('sceneEdits',[])]
eb=[json.dumps(e,sort_keys=True,ensure_ascii=False) for e in sb.get('sceneEdits',[])]
print(f'  sceneEdits: {len(ea)} -> {len(eb)}')
for op,i1,i2,j1,j2 in difflib.SequenceMatcher(a=ea,b=eb,autojunk=False).get_opcodes():
    if op=='equal': continue
    for x in ea[i1:i2]: print('    - '+x[:300])
    for x in eb[j1:j2]: print(f'    + [{j1}] '+x[:300]); j1+=1
pa,pb=sa.get('people',{}),sb.get('people',{})
for k in sorted(set(pa)|set(pb)):
    if k=='cast': continue
    if pa.get(k)!=pb.get(k):
        for l in diff({k:pa.get(k)},{k:pb.get(k)}): print('  people/'+l[:260])
ca={c.get('key'):c for c in pa.get('cast',[])}; cb={c.get('key'):c for c in pb.get('cast',[])}
print('  cast order equal:',[c.get('key') for c in pa.get('cast',[])]==[c.get('key') for c in pb.get('cast',[])])
for k in list(ca)+[k for k in cb if k not in ca]:
    if ca.get(k)==cb.get(k): print(f'  cast {k}: identical'); continue
    d=diff(ca.get(k) or {},cb.get(k) or {})
    print(f'  cast {k}: {len(d)} differences')
    for l in d: print('    '+l[:220])
