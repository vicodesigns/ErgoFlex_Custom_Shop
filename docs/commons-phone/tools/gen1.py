import json,sys,copy,numpy as np
from scipy.spatial.transform import Rotation as Rot, Slerp
from ik import *
CH_X=lambda t: min(2.0654+(t-12.0)*1.0094, 3.2469) if t<12.9 else None
def charger_x(t):
    tab={11.4:1.4596,12.0:2.0654,12.9:2.974,13.0:3.0688,13.1:3.1438,13.2:3.1984,13.3:3.2328,13.4:3.2469}
    ts=sorted(tab); return float(np.interp(t,ts,[tab[k] for k in ts]))
def build(params):
    """params: dict T0,T1,Tr,hover,yaw,mid_lift ; returns dict bone->list of (t,rotvec)"""
    T0,T1,Tr=params['T0'],params['T1'],params['Tr']
    hover=params.get('hover',0.075)
    base_c=phone_centre(P0,Q0); tq=target_q(params.get('yaw',0.0))
    tgt=np.array([charger_x(Tr)+params.get('dx',0.0),1.123+hover,-10.838+params.get('dz',0.0)])
    keys=[]
    x_prev=np.zeros(18)
    slerp=Slerp([0,1],Rot.concatenate([Q0['held_hand_r'],tq]))
    for (t,s) in [(T0,0.0),(T1,params.get('smid',0.5)),(Tr,1.0)]:
        if s==0: keys.append((t,np.zeros(18))); continue
        c=base_c+(tgt-base_c)*s+np.array([0,params.get('mid_lift',0.06)*np.sin(np.pi*s),0])
        # orientation interpolation: temporarily override target_q
        import ik
        q=slerp([s])[0]
        orig=ik.target_q; ik.target_q=lambda yaw=0.0,q=q:q
        sol,P,Q,ep,eo=ik.solve(c,x0=x_prev,w_or=params.get('w_or',0.35))
        ik.target_q=orig
        print(f't={t} s={s} pos err {ep:.3f} orient err {eo:.1f} deg  elbow {np.round(P["lowerarm_r"],2)} hand {np.round(P["hand_r"],2)}',file=sys.stderr)
        x_prev=sol; keys.append((t,sol))
    return keys
if __name__=='__main__':
    p=dict(T0=11.7,T1=12.35,Tr=12.9)
    keys=build(p)
    json.dump([[t,x.tolist()] for t,x in keys],open('ik-keys1.json','w'))
