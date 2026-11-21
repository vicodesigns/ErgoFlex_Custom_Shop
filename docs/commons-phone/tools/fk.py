import json,numpy as np
from scipy.spatial.transform import Rotation as Rot
CHAIN=['spine_02','spine_03','clavicle_r','upperarm_r','lowerarm_r','hand_r','held_hand_r']
def load_base(path='pb3/probe.jsonl'):
    d=json.loads(open(path).readline())
    P={};Q={}
    for o in d['objects']:
        if o['name'] in CHAIN and o['name'] not in P:
            P[o['name']]=np.array(o['pos']); Q[o['name']]=Rot.from_quat(o['quat'])
    return P,Q
def fk(P0,Q0,deltas):
    """deltas: dict bone->rotvec (bone-local, post-multiplied). Returns P,Q dicts."""
    P={k:v.copy() for k,v in P0.items()}; Q=dict(Q0)
    for i,b in enumerate(CHAIN):
        if b not in deltas: continue
        D=Rot.from_rotvec(deltas[b]); W=Q[b]*D*Q[b].inv()
        pb=P[b].copy()
        for d in CHAIN[i:]:
            P[d]=pb+W.apply(P[d]-pb) if d!=b else P[d]
            Q[d]=W*Q[d]
    return P,Q
if __name__=='__main__':
    P0,Q0=load_base()
    meta=json.load(open('sweep1-meta.json'))
    rows=[json.loads(l) for l in open('sw1/probe.jsonl')]
    def get(row,name):
        for o in row['objects']:
            if o['name']==name: return np.array(o['pos'])
    for lab,rv,row in zip(meta['labels'],meta['cands'],rows):
        deltas={b:np.array(v) for b,v in rv.items() if any(v)}
        P,Q=fk(P0,Q0,deltas)
        meas=get(row,'hand_r')-get(rows[0],'hand_r'); pred=P['hand_r']-P0['hand_r']
        print(lab.ljust(14),'meas',np.round(meas,3),'pred',np.round(pred,3))
