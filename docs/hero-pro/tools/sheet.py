# usage: python sheet.py <out prefix> <step s> <label> <video> [<label> <video> ...] [--per N] [--w 427]
# Contact sheets of hero renders side by side: one row per time (every <step> s from 0 to the longest video), one column per
# video, each frame stamped with its chapter time and its label. N rows per sheet (default 12): <prefix>-01.png, -02.png ...
import sys, subprocess, os
sys.path.insert(0, 'C:/work/fixB/pylib')   # Pillow / matplotlib on the render PC
from PIL import Image, ImageDraw, ImageFont
a = sys.argv[1:]
per = int(a[a.index('--per') + 1]) if '--per' in a else 12
W = int(a[a.index('--w') + 1]) if '--w' in a else 427
for k in ('--per', '--w'):
    if k in a: i = a.index(k); del a[i:i + 2]
prefix, step = a[0], float(a[1]); pairs = list(zip(a[2::2], a[3::2]))
H = round(W * 9 / 16)
def dur(v): return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', v]))
def grab(v, t):
    p = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{t:.3f}', '-i', v, '-frames:v', '1', '-vf', f'scale={W}:{H}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True)
    return Image.frombytes('RGB', (W, H), p.stdout) if len(p.stdout) == W * H * 3 else Image.new('RGB', (W, H), (40, 0, 0))
D = max(dur(v) for _, v in pairs)
times = [round(i * step, 3) for i in range(int(D / step + 1e-6) + 1) if i * step < D - 1 / 60]
font = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 15)
outs = []
for s in range(0, len(times), per):
    ts = times[s:s + per]
    img = Image.new('RGB', (W * len(pairs) + 4 * (len(pairs) - 1), (H + 4) * len(ts)), (255, 255, 255))
    d = ImageDraw.Draw(img)
    for r, t in enumerate(ts):
        for c, (lab, v) in enumerate(pairs):
            x, y = c * (W + 4), r * (H + 4)
            img.paste(grab(v, min(t, dur(v) - 1 / 30)), (x, y))
            txt = f'{t:5.2f} s  {lab}'
            d.rectangle([x + 4, y + 4, x + 12 + d.textlength(txt, font=font), y + 24], fill=(0, 0, 0))
            d.text((x + 8, y + 6), txt, fill=(255, 255, 255), font=font)
    o = f'{prefix}-{s // per + 1:02d}.png'; img.save(o); outs.append(o)
print('\n'.join(outs))
