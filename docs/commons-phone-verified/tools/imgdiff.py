"""imgdiff.py <dirA> <dirB> <labels csv> [outdir]: per-frame diff stats (grey levels 0-255) and a diff mask image per frame.
Reports mean abs diff, % pixels > 4 and > 16, and the bounding box of pixels > 16 (the changed region)."""
import sys,os
sys.path.insert(0,'C:/work/cphone/pylib')
from PIL import Image,ImageChops
import numpy as np
A,B,labels=sys.argv[1],sys.argv[2],sys.argv[3].split(',')
out=sys.argv[4] if len(sys.argv)>4 else None
if out: os.makedirs(out,exist_ok=True)
fa=sorted(f for f in os.listdir(A) if f.endswith(('.jpg','.png')))
for k,f in enumerate(fa):
    a=np.asarray(Image.open(os.path.join(A,f)).convert('L'),dtype=np.int16); b=np.asarray(Image.open(os.path.join(B,f)).convert('L'),dtype=np.int16)
    d=np.abs(a-b); big=d>16
    ys,xs=np.nonzero(big)
    bb=f'x{xs.min()}-{xs.max()} y{ys.min()}-{ys.max()}' if len(xs) else '-'
    lab=labels[k] if k<len(labels) else f
    print(f'{lab:>7}s  mean {d.mean():.3f}  max {d.max():3d}  >4: {100*(d>4).mean():.3f}%  >16: {100*big.mean():.4f}%  changed box {bb}')
    if out: Image.fromarray(np.clip(d*8,0,255).astype(np.uint8)).save(os.path.join(out,f'diff-{lab}.png'))
