# Per-frame motion metrics for a render: python3 motion.py renders/NN.mkv > framediff-NN.txt
# Columns: t (s), mean abs luma diff vs previous frame (384x216 gray), phase-corr shift dx dy, mean luma, LOW flag (<0.15)
import sys, subprocess, numpy as np, hashlib
f=sys.argv[1]; W,H=384,216
raw=subprocess.run(['ffmpeg','-v','error','-i',f,'-vf',f'scale={W}:{H},format=gray','-f','rawvideo','-'],capture_output=True).stdout
fr=np.frombuffer(raw,np.uint8).reshape(-1,H,W).astype(np.float32)
n=len(fr); d=np.abs(np.diff(fr,axis=0)).mean(axis=(1,2))
def shift(a,b):
    A=np.fft.fft2(a-a.mean());B=np.fft.fft2(b-b.mean());R=A*np.conj(B);R/=np.abs(R)+1e-9
    r=np.fft.ifft2(R).real;y,x=np.unravel_index(r.argmax(),r.shape)
    return (x-W if x>W/2 else x),(y-H if y>H/2 else y)
h=[hashlib.md5(x.tobytes()).hexdigest() for x in fr]
print('frames',n,'exact dup frames',[i for i in range(1,n) if h[i]==h[i-1]])
print('t     meandiff  dx  dy  lum'); lum=fr.mean(axis=(1,2))
for i in range(n-1):
    dx,dy=shift(fr[i+1],fr[i]); print(f'{(i+1)/30:6.3f} {d[i]:7.3f} {dx:4d} {dy:4d} {lum[i+1]:6.1f} {"LOW" if d[i]<0.15 else ""}')
