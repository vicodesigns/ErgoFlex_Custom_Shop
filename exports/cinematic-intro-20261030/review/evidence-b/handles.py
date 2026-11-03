import json,sys,numpy as np
for ch in ['07','08','09','10','11','12']:
    d=json.load(open(f'shots/{ch}.json'));T=d['seconds'];K=d['camera']['keys']
    t=np.array([k['time'] for k in K]); t=t*T if t[-1]<=1.0001 else t; P=np.array([k['view']['position'] for k in K]);G=np.array([k['view']['target'] for k in K])
    def at(s): return np.array([np.interp(s,t,P[:,i]) for i in range(3)]),np.array([np.interp(s,t,G[:,i]) for i in range(3)])
    def ang(a,b):
        da=a[1]-a[0];db=b[1]-b[0];da/=np.linalg.norm(da);db/=np.linalg.norm(db);return np.degrees(np.arccos(np.clip(da@db,-1,1)))
    for name,(s0,s1) in [('head1.5',(0,1.5)),('tail1.5',(T-1.5,T))]:
        a=at(s0);b=at(s1)
        print(ch,name,f'travel {np.linalg.norm(b[0]-a[0])*100:.1f} cm, rot {ang(a,b):.2f} deg, dist to target {np.linalg.norm(a[1]-a[0]):.2f} m')
