import json,sys,numpy as np,subprocess
from build_final import *
keys=[(t,np.array(x)) for t,x in json.load(open('ik-keys-final.json'))]
Tr=keys[-1][0]
bases={'vicos-2nd-cut':'base2-commons.json','vicos-3rd-cut':'F:/eng-phone/exports/cinematic-intro-cut-vicos-3rd-cut/director-film/commons.json','vicos-3rd-cut-standing':'F:/eng-phone/exports/cinematic-intro-cut-vicos-3rd-cut-standing/director-film/commons.json'}
import os
os.makedirs('out',exist_ok=True)
for cid,p in bases.items():
    b=json.load(open(p,encoding='utf8')); o=build(b,keys,Tr)
    json.dump(o,open(f'out/commons-{cid}.json','w',encoding='utf8',newline='\n'),indent=1)
    subprocess.run([sys.executable,'make_export.py',cid,f'out/commons-{cid}.json',f'out/export-{cid}-commons-phone.json'],check=True)
# by-key patch from the 2nd-cut build
b=json.load(open('base2-commons.json',encoding='utf8')); o=build(b,keys,Tr)
cast={c['key']:c for c in o['people']['cast']}
mine=[e for e in o['sceneEdits'] if (e.get('match') in ('^Prop:ergoflex-phone$',) or e.get('id')==ID or e.get('match')==f'^Added prop:ergoflex-phone#{ID}$')]
patch={'chapter':'commons','note':'Commons phone: Yara takes the charger phone (5.1-5.4 s); Mia reaches over and puts her phone on the charger at the release time; charging cue. Merge by key: cast entries by key, people.when by key, sceneEdits by (match, add id | material).',
 'releaseSeconds':Tr,
 'people':{'when':{k:o['people']['when'][k] for k in ('mia-waits','mia-works')},
  'cast':{'mia-waits':{'postures':{'people-mia-power-phone':{'poseKeys':cast['mia-waits']['postures']['people-mia-power-phone']['poseKeys']}}},
          'mia-works':{'postures':{'people-mia-power-type-30':{'poseKeys':cast['mia-works']['postures']['people-mia-power-type-30']['poseKeys']}},'swap':cast['mia-works']['swap'],'change':cast['mia-works']['change']}}},
 'sceneEdits':mine}
os.makedirs('F:/eng-phone/docs/commons-phone',exist_ok=True)
json.dump(patch,open('F:/eng-phone/docs/commons-phone/commons-phone-patch.json','w',encoding='utf8',newline='\n'),indent=1)
print(json.dumps(patch['people'],indent=None)[:1500])
