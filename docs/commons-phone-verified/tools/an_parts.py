"""an_parts.py <probe.jsonl>: phone parts (sizes, shown), PCA frames of the held phone (Mia) and the added phone; landing error."""
import json,sys
import numpy as np
rows=[json.loads(l) for l in open(sys.argv[1])]
def frame(o):
    c=np.array(o['pca']['centre']); C=np.array(o['pca']['cov']); w,v=np.linalg.eigh(C)
    return c,w,v   # ascending: v[:,0] = thinnest axis (normal), v[:,2] = longest
def parts(r,key):
    return [o for o in r['objects'] if key in (o.get('path') or '')]
mode=sys.argv[2] if len(sys.argv)>2 else 'all'
for r in rows:
    t=r['t']
    if mode=='parts' and t in (5.0,13.5):
        for key in ('Prop:ergoflex-phone>','mph01'):
            ps=parts(r,key)
            if not ps: continue
            print(f'--- t={t} {key} {len(ps)} parts')
            for o in ps:
                b=o['box']; sz=[round((b[3+i]-b[i])*1000) for i in range(3)] if b else None
                print(f"  {o['name']:28s} {'shown' if o['shown'] else 'HIDDEN'} size mm {sz} centre {[round((b[i]+b[3+i])/2,4) for i in range(3)] if b else None}")
    if mode=='all':
        out=[f't={t}']
        for o in r['objects']:
            if o['name'] in ('base001_1','base001_2') and 'mia-power-phone' in (o.get('path') or '') and o.get('pca') and 'centre' in o['pca']:
                c,w,v=frame(o); n=v[:,0]; n=n if n[1]>0 else -n
                out.append(f"{o['name']}({'on' if o['shown'] else 'off'}) c={np.round(c,4).tolist()} tilt={np.degrees(np.arccos(abs(n[1]))):.1f}deg long={np.round(v[:,2],3).tolist()} dims~{np.round(np.sqrt(w)*1000*3.46,0).tolist()}")
        print('  '.join(out))
