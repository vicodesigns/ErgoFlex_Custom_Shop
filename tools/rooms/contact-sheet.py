#!/usr/bin/env python3
"""Contact sheet of stills: contact-sheet.py <out.jpg> <columns> <image> [image ...]   (each tile carries its file name)"""
import sys, os
from PIL import Image, ImageDraw
out, cols, files = sys.argv[1], int(sys.argv[2]), [f for f in sys.argv[3:] if os.path.exists(f)]
W, H = 800, 450; rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * W, rows * H), 'black'); draw = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    x, y = (i % cols) * W, (i // cols) * H
    sheet.paste(Image.open(f).convert('RGB').resize((W, H), Image.LANCZOS), (x, y))
    label = os.path.splitext(os.path.basename(f))[0]; draw.rectangle([x, y, x + 8 + 7 * len(label), y + 18], fill='black'); draw.text((x + 5, y + 3), label, fill='yellow')
sheet.save(out, quality=88); print(out, len(files))
