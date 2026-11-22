"""make_fixed.py <cut dir (current seated cut)> <raw Director export (Vico's latest commons)> <keys json> <outdir> [--tr 12.7] [--add x,y,z] [--rot x,y,z] [--scale s] [--glowmat name] [--fade from,to,fadeOut] [--mesh name ...]
Builds, from the CURRENT seated cut's commons film shot (not the patch branch's older copy):
  <outdir>/commons-built.json   the patched film shot (for renders: mkview/mkcut)
  <outdir>/export-vicos-3rd-cut-commons-phone.json   Vico's raw export with peopleEdits (v 2) = the patched people
  <outdir>/commons-phone-patch.json  the by-key patch apply_hand.py merges (the 3 hand sceneEdits)
Keeps Vico's mia-works typing pose key (only its time moves to the end of the change) and Vico's motion / camera."""
import json,sys,os,copy,argparse
sys.path.insert(0,'C:/work/cphone/patch/docs/commons-phone/tools')
import numpy as np
import build_final as bf
ap=argparse.ArgumentParser()
ap.add_argument('cut'); ap.add_argument('raw'); ap.add_argument('keys'); ap.add_argument('out')
ap.add_argument('--tr',type=float,default=None); ap.add_argument('--add',default=None); ap.add_argument('--rot',default='0,0,0')
ap.add_argument('--scale',type=float,default=1.0); ap.add_argument('--glowmat',default='^hUlRcbieVuIiOXG$')
ap.add_argument('--glow',default=None,help='t0,t1,peak,t2,settle relative to Tr: default 0.25,0.8,0.6,1.8,0.3')
ap.add_argument('--fade',default='0,5.4,0.3'); ap.add_argument('--showfrom',type=float,default=None)
ap.add_argument('--fixglow',action='store_true'); ap.add_argument('--glowcolor',default='#cadef6')
ap.add_argument('--glowkeys',default='[[12.7,0.7],[12.95,0.7],[13.1,0.25],[13.35,1.0],[14.2,1.0],[15.0,0.35]]')
ap.add_argument('--extra',default=None,help='json file: extra mia-waits poseKeys (list of {t,pose}) merged in')
a=ap.parse_args()
cut=json.load(open(os.path.join(a.cut,'review-cut.json'),encoding='utf8'))
base=next(s for s in cut['shots'] if s['id']=='commons')
raw=json.load(open(a.raw,encoding='utf8'))
kj=json.load(open(a.keys,encoding='utf8'))
keys=[(t,np.array(x)) for t,x in kj]
Tr=a.tr if a.tr is not None else keys[-1][0]
add=[float(x) for x in a.add.split(',')] if a.add else bf.ADD_POS
fade=tuple(float(x) for x in a.fade.split(','))
d=bf.build(base,keys,Tr,fade=fade,add_pos=add,scale=(a.scale,)*3,glow=True)
se=d['sceneEdits']
for e in se:
    if e.get('id')==bf.ID and 'add' in e:
        e['rotation']=[float(x) for x in a.rot.split(',')]
        if a.showfrom is not None: e['show']['from']=round(a.showfrom,3)
    if e.get('match')=='^Prop:ergoflex-phone$' and 'show' in e and not e['show'].get('fadeOut'): e['show'].pop('fadeOut',None)
    if e.get('match')==f'^Added prop:ergoflex-phone#{bf.ID}$' and 'material' in e:
        e['materialName']=a.glowmat
        if a.fixglow:
            # film-edits.mjs targets(): with materialName the MESH name must match `match` (the added prop's group name
            # matched no mesh: count 0, no glow). The meshes are Supplied_phone_part_N; `path` keeps it to this prop.
            e['match']=r'^Supplied_phone_part_\d+$'; e['path']=f'Added prop:ergoflex-phone#{bf.ID}'
            e['label']="Charging cue: Mia's phone screen (lit as in her hand), dims, wakes with the charging flash, then a faint charging glow"
            e['material']={'emissive':a.glowcolor,'emissiveIntensity':json.loads(a.glowkeys)}
            # clone: the added phone shares its GLB materials with the desk's charger phone (Yara's, 0-5.25 s): without
            # its own copy the glow lit Yara's phone screen too (seen in the first v2 renders of 21 Nov, 4.75-5.23 s)
            e['clone']=True
        elif a.glow:
            g0,g1,pk,g2,st=[float(x) for x in a.glow.split(',')]
            e['material']['emissiveIntensity']=[[round(Tr,3),0],[round(Tr+g0,3),0],[round(Tr+g1,3),pk],[round(Tr+g2,3),st]]
cast={c['key']:c for c in d['people']['cast']}
if a.extra:
    ex=json.load(open(a.extra,encoding='utf8'))
    pk=cast['mia-waits']['postures']['people-mia-power-phone']['poseKeys']
    pk+=ex; pk.sort(key=lambda k:k['t'])
# Vico's typing key: keep its exact pose (build_final put identity on spine/clavicle, which his key did not name: same thing)
bk={c['key']:c for c in base['people']['cast']}
vk=bk['mia-works']['postures']['people-mia-power-type-30']['poseKeys']
wk=cast['mia-works']['postures']['people-mia-power-type-30']['poseKeys']
for b,q in vk[-1]['pose'].items(): assert wk[-1]['pose'][b]==q,(b,q,wk[-1]['pose'][b])
os.makedirs(a.out,exist_ok=True)
json.dump(d,open(os.path.join(a.out,'commons-built.json'),'w',encoding='utf8',newline='\n'),indent=1,ensure_ascii=False)
ex=copy.deepcopy(raw); shot=ex['shots'][0]
assert shot['id']=='commons' and ex['id']=='film-vicos-3rd-cut-commons'
# merge BY KEY into Vico's own peopleEdits: only mia-waits / mia-works and their people.when change; everybody else is his export's
pe=copy.deepcopy(shot['peopleEdits']); assert pe.get('v')==2
for i,c in enumerate(pe['cast']):
    if c.get('key') in ('mia-waits','mia-works'): pe['cast'][i]=copy.deepcopy(cast[c['key']])
for k in ('mia-waits','mia-works'): pe['when'][k]=copy.deepcopy(d['people']['when'][k])
film_way={'v':2,**copy.deepcopy(d['people'])}
print('peopleEdits by-key merge == film people + patch:',pe==film_way)
shot['peopleEdits']=pe
json.dump(ex,open(os.path.join(a.out,'export-vicos-3rd-cut-commons-phone.json'),'w',encoding='utf8',newline='\n'),indent=2,ensure_ascii=False)
mine=[e for e in se if (e.get('match')=='^Prop:ergoflex-phone$' or e.get('id')==bf.ID or e.get('match')==f'^Added prop:ergoflex-phone#{bf.ID}$' or e.get('path')==f'Added prop:ergoflex-phone#{bf.ID}')]
patch={'chapter':'commons','cut':'vicos-3rd-cut (seated)','note':'Commons phone (verified on the current seated 3rd cut): the HAND sceneEdits that apply_hand.py merges by key after the importer. The people part rides in the export doc (peopleEdits).',
       'releaseSeconds':Tr,'people':{'when':{k:d['people']['when'][k] for k in ('mia-waits','mia-works')}},'sceneEdits':mine}
json.dump(patch,open(os.path.join(a.out,'commons-phone-patch.json'),'w',encoding='utf8',newline='\n'),indent=1,ensure_ascii=False)
print('built Tr',Tr,'when',d['people']['when'],'mia-works keys',[k['t'] for k in wk],'mia-waits keys',[k['t'] for k in cast['mia-waits']['postures']['people-mia-power-phone']['poseKeys']])
