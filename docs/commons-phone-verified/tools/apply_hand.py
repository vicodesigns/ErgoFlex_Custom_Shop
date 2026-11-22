#!/usr/bin/env python3
"""Commons phone (verified): merges the HAND sceneEdits of the patch into a cut folder's commons chapter, AFTER the importer.
usage: apply_hand.py <cut folder> <commons-phone-patch.json> [--check]
  - touches review-cut.json (and shots/NN.json if one carries the commons chapter); nothing else.
  - removes every earlier entry of this patch (the charger phone's show, the added phone mph01, and its glow, including
    the 2026-11-20 glow entry whose match '^Added prop:ergoflex-phone#mph01$' + materialName matched no mesh), then puts
    the patch's entries in front of the Director's (director: true) entries, as the builders' hand-made edits are.
  - idempotent: a second run changes nothing. --check: say what would change, write nothing.
Based on docs/commons-phone/tools/apply_hand.py (2026-11-20)."""
import json,sys,os,glob
H,patchp=sys.argv[1:3]; check='--check' in sys.argv
patch=json.load(open(patchp,encoding='utf8'))
assert patch.get('chapter')=='commons'
mine=patch['sceneEdits']
def ours(e):
    m=str(e.get('match','')); p=str(e.get('path',''))
    return (m=='^Prop:ergoflex-phone$' and 'show' in e and not e.get('director')) or e.get('id')=='mph01' or 'ergoflex-phone#mph01' in m or 'ergoflex-phone#mph01' in p
def merge(shot):
    se=[e for e in (shot.get('sceneEdits') or []) if not ours(e)]
    first=next((i for i,e in enumerate(se) if e.get('director')),len(se))
    shot['sceneEdits']=se[:first]+json.loads(json.dumps(mine))+se[first:]
n=0
for p in [os.path.join(H,'review-cut.json')]+sorted(glob.glob(os.path.join(H,'shots','[0-9][0-9].json'))):
    if not os.path.exists(p): continue
    d=json.load(open(p,encoding='utf8')); before=json.dumps(d,sort_keys=True)
    shots=d['shots'] if 'shots' in d else [d]
    for s in shots:
        if s.get('id')=='commons': merge(s)
    if json.dumps(d,sort_keys=True)!=before:
        n+=1; print(('would patch' if check else 'patched'),os.path.relpath(p,H))
        if not check:
            with open(p,'w',encoding='utf8',newline='\n') as f: json.dump(d,f,indent=1)
print('files patched:',n)
