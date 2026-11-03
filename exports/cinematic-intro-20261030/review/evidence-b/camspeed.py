import json,sys,numpy as np
d=json.load(open(sys.argv[1])); T=d['seconds']
K=d['camera']['keys']
t=np.array([k['time'] for k in K])*(T if K[-1]['time']<=1.0001 else 1)
P=np.array([k['view']['position'] for k in K]); G=np.array([k['view']['target'] for k in K]); F=np.array([k['view']['fov'] for k in K])
ts=np.arange(0,T+1e-9,1/30)
def interp(A): return np.stack([np.interp(ts,t,A[:,i]) for i in range(A.shape[1])],1)
p=interp(P); g=interp(G); f=np.interp(ts,t,F)
dirv=(g-p); dirv/=np.linalg.norm(dirv,axis=1)[:,None]
v=np.linalg.norm(np.diff(p,axis=0),axis=1)*30
ang=np.degrees(np.arccos(np.clip((dirv[1:]*dirv[:-1]).sum(1),-1,1)))*30
dfov=np.abs(np.diff(f))*30
print('T',T,'key time range',t[0],t[-1],'n',len(t))
for s in np.arange(0,T,0.5):
    i=int(s*30); j=min(int((s+0.5)*30),len(v))
    print(f'{s:5.1f} pos {v[i:j].mean():.3f} m/s  rot {ang[i:j].mean():5.2f} deg/s fov {dfov[i:j].mean():.2f}/s  p={np.round(p[i],2)} fov={f[i]:.1f}')
# min pos y, and acceleration jumps
a=np.diff(v)*30
print('max |accel| m/s2', np.abs(a).max().round(3), 'at', (np.abs(a).argmax()+1)/30)
print('min cam y', p[:,1].min().round(3),'max', p[:,1].max().round(3))
