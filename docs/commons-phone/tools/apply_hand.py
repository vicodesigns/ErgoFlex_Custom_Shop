#!/usr/bin/env python3
"""Applies the commons-phone HAND sceneEdits (by key) to a cut folder's review-cut.json (and shots/NN.json if it has the chapter).
usage: apply_hand.py <cut folder> <patch json (docs/commons-phone/commons-phone-patch.json)>"""
import json,sys,os,glob
H,patchp=sys.argv[1:3]
patch=json.load(open(patchp,encoding='utf8'))
mine=patch['sceneEdits']
def key(e): return ('add',e['id']) if e.get('add') else (e.get('match'),'material' if 'material' in e else 'show')
def merge(shot):
    se=shot.get('sceneEdits') or []
    keys={key(e) for e in mine}
    se=[e for e in se if key(e) not in keys]
    first=next((i for i,e in enumerate(se) if e.get('director')),len(se))     # hand entries stay before the Director's
    shot['sceneEdits']=se[:first]+json.loads(json.dumps(mine))+se[first:]
def dump(p,d):
    with open(p,'w',encoding='utf8',newline='\n') as f: json.dump(d,f,indent=1)
n=0
for p in [os.path.join(H,'review-cut.json')]+sorted(glob.glob(os.path.join(H,'shots','[0-9][0-9].json'))):
    if not os.path.exists(p): continue
    d=json.load(open(p,encoding='utf8'))
    shots=d['shots'] if 'shots' in d else [d]
    hit=False
    for s in shots:
        if s.get('id')=='commons': merge(s); hit=True
    if hit: dump(p,d); n+=1; print('patched',os.path.relpath(p,H))
print('files patched:',n)
