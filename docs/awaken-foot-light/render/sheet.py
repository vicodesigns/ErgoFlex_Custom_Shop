import sys, os
sys.path.insert(0, 'C:/work/fixB/pylib')
from PIL import Image, ImageDraw, ImageFont
# sheet.py <before dir> <after dir> <out prefix>: before | after, every 0.5 s from 6 to 10 s (full frame, and a crop of the floor under the base)
bd, ad, out = sys.argv[1:4]
SECS = 44.85
def fr(d):
    return {round(float(f.split('-t')[1][:-4]) * SECS, 2): os.path.join(d, f) for f in os.listdir(d) if f.endswith('.png') and '-still-1920x1080-t' in f}
b, a = fr(bd), fr(ad)
ts = [t for t in [6 + .5 * i for i in range(9)] if t in a and t in b]
font = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 20)
def sheet(name, box, w):
    h = round(w * (box[3] - box[1]) / (box[2] - box[0]))
    S = Image.new('RGB', (w * 2 + 6, (h + 4) * len(ts)), (20, 20, 20))
    for i, t in enumerate(ts):
        for j, (lab, p) in enumerate((('before', b[t]), ('after', a[t]))):
            im = Image.open(p).convert('RGB').crop(box).resize((w, h), Image.LANCZOS)
            d = ImageDraw.Draw(im); d.rectangle((0, 0, 190, 28), fill=(0, 0, 0)); d.text((6, 3), f'{t:g} s  {lab}', fill=(255, 255, 255), font=font)
            S.paste(im, (j * (w + 6), i * (h + 4)))
    S.save(out + name, quality=90) if name.endswith('.jpg') else S.save(out + name)
sheet('-sheet-full.jpg', (0, 0, 1920, 1080), 640)
sheet('-sheet-floor.jpg', (700, 700, 1920, 1080), 800)
