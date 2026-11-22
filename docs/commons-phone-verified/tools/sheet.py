"""sheet.py <out.jpg> <cols> <label:path> ...  contact sheet, each tile 480x270 with its label; also used for side-by-side (base|new)."""
import sys
sys.path.insert(0,'C:/work/cphone/pylib')
from PIL import Image,ImageDraw,ImageFont
out=sys.argv[1]; cols=int(sys.argv[2]); items=[a.split('|',1) for a in sys.argv[3:]]
W,H=480,270
rows=(len(items)+cols-1)//cols
S=Image.new('RGB',(cols*W,rows*H),'black'); d=ImageDraw.Draw(S)
try: f=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',18)
except Exception: f=None
for k,(lab,p) in enumerate(items):
    im=Image.open(p).convert('RGB').resize((W,H),Image.LANCZOS)
    x,y=(k%cols)*W,(k//cols)*H; S.paste(im,(x,y))
    d.rectangle([x+4,y+4,x+8+len(lab)*10,y+28],fill=(0,0,0)); d.text((x+8,y+6),lab,fill=(255,255,255),font=f)
S.save(out,quality=90); print('sheet',out,S.size)
