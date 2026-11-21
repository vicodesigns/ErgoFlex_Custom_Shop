#!/usr/bin/env python3
"""Commons phone: builds the changed commons chapter from a base commons chapter (film data) and writes the by-key patch.
usage: build_final.py <base chapter json> <out chapter json> <out patch json> [--keys ik-keys.json]"""
import json,copy,sys
import numpy as np
from sweeplib import rv2q
BONES=['spine_02','spine_03','clavicle_r','upperarm_r','lowerarm_r','hand_r']
LEFT=['upperarm_l','lowerarm_l','hand_l']
ID='mph01'
PHONE_FADE=(0.0,5.4,0.3)           # the charger phone: drawn 0..5.4 s, faded out over the last 0.3 s (Yara walks off at 5.3)
ADD_POS=[-0.6238,0.0149,0.3056]    # desk-mount frame metres: the charger spot
CHANGE_L=1.1
def q4(rv): return [round(float(x),4) for x in rv2q(list(rv))]
def build(base,keys,Tr,fade=PHONE_FADE,add_pos=ADD_POS,scale=(1,1,1),glow=True):
    d=copy.deepcopy(base)
    cast={c['key']:c for c in d['people']['cast']}
    waits,works=cast['mia-waits'],cast['mia-works']
    wk=[{'t':round(t,3),'pose':{b:q4(x[3*j:3*j+3]) for j,b in enumerate(BONES)}} for t,x in keys]
    waits['postures']['people-mia-power-phone']['poseKeys']=wk
    last=wk[-1]['pose']
    old=works.get('postures',{}).get('people-mia-power-type-30',{}).get('poseKeys')
    typing=old[0]['pose'] if old else None     # Vico's typing offsets (2nd cut); the 3rd cuts have none
    s=Tr-0.02*CHANGE_L; at=s+CHANGE_L/2; Kend=s+CHANGE_L
    idq=[0,0,0,1]
    k1={'t':round(Tr,3),'pose':{**{b:last[b] for b in BONES},**{b:idq for b in LEFT}}}
    if typing:
        k2pose={b:typing[b] for b in typing}
        for b in ('spine_02','spine_03','clavicle_r'): k2pose[b]=idq
    else:
        k2pose={b:idq for b in BONES+LEFT}
    k2={'t':round(Kend,3),'pose':k2pose}
    works.setdefault('postures',{}).setdefault('people-mia-power-type-30',{})['poseKeys']=[k1,k2]
    works['swap']=0.02
    works['change']={'seconds':CHANGE_L,'arms':[0.15,1.0]}
    d['people']['when']['mia-waits']=[[0,round(at+0.25,3),0,0.5]]
    d['people']['when']['mia-works']=[[round(at-0.25,3),99,0.5,0]]
    se=d['sceneEdits']
    se[:]=[e for e in se if not (e.get('match') in ('^Prop:ergoflex-phone$',) or e.get('id')==ID or e.get('match')==f'^Added prop:ergoflex-phone#{ID}$')]
    # hand-made film entries (no director flag): kept by every import; the add must come before the material edit that targets it
    hand=[e for e in se if not e.get('director')]; dire=[e for e in se if e.get('director')]
    f0,f1,fo=fade
    hand.append({'match':'^Prop:ergoflex-phone$','label':'iPhone \u00b7 Wireless charger (Yara takes her phone)','show':{'from':f0,'to':f1,'fadeOut':fo}})
    hand.append({'add':{'asset':'ergoflex-phone'},'id':ID,'match':f'^Added prop:ergoflex-phone#{ID}$','label':"iPhone \u00b7 Mia's phone on the charger",'parent':'desk','position':list(add_pos),'rotation':[0,0,0],'scale':list(scale),'show':{'from':round(Tr,3),'to':10000}})
    if glow:
        hand.append({'match':f'^Added prop:ergoflex-phone#{ID}$','label':"Charging cue: Mia's phone screen brightens a little when it starts charging",'materialName':'^hUlRcbieVuIiOXG$','material':{'emissive':'#9fd8ff','emissiveIntensity':[[round(Tr,3),0],[round(Tr+0.25,3),0],[round(Tr+0.8,3),0.6],[round(Tr+1.8,3),0.3]]}})
    se[:]=hand+dire
    return d
if __name__=='__main__':
    base=json.load(open(sys.argv[1]))
    keys=[(t,np.array(x)) for t,x in json.load(open(sys.argv[4] if len(sys.argv)>4 else 'ik-keys-final.json'))]
    Tr=keys[-1][0]
    out=build(base,keys,Tr)
    json.dump(out,open(sys.argv[2],'w'),indent=None)
    print('built; Tr',Tr)
