"""crop.py <out> <x0,y0,x1,y1> <scale> <label|path> ...: crops of the same region side by side (zoomed)."""
import sys
sys.path.insert(0,'C:/work/cphone/pylib')
from PIL import Image,ImageDraw,ImageFont
out=sys.argv[1]; box=tuple(int(v) for v in sys.argv[2].split(',')); sc=float(sys.argv[3]); items=[a.split('|',1) for a in sys.argv[4:]]
w,h=int((box[2]-box[0])*sc),int((box[3]-box[1])*sc)
cols=min(len(items),4); rows=(len(items)+cols-1)//cols
S=Image.new('RGB',(cols*w,rows*h)); d=ImageDraw.Draw(S); f=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',16)
for k,(lab,p) in enumerate(items):
    im=Image.open(p).convert('RGB').crop(box).resize((w,h),Image.LANCZOS); x,y=(k%cols)*w,(k//cols)*h; S.paste(im,(x,y))
    d.rectangle([x+2,y+2,x+6+len(lab)*9,y+22],fill=(0,0,0)); d.text((x+5,y+4),lab,fill=(255,255,255),font=f)
S.save(out,quality=92); print(out,S.size)
