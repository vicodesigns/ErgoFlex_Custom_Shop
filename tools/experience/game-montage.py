#!/usr/bin/env python3
"""Retro-to-modern videogame montage for the music chapter's main monitor.

    python3 tools/experience/game-montage.py <game-src dir> <out.mp4> [WxH]

Franchise pairs, each jumping from its retro original to its modern entry,
cut hard on the score's beat grid (3 beats per shot). The chapter's dissolve
centre (0.75 s) is a bar line in the score, so the first gameplay cut lands
there; the title card covers the dissolve. Retro sources are pillarboxed over
a blurred copy with nearest-neighbour scaling to keep the pixels crisp.
"""
import subprocess, sys

src, out = sys.argv[1], sys.argv[2]
W, H = map(int, (sys.argv[3] if len(sys.argv) > 3 else '1920x1080').split('x'))
FONT = '/home/ergo/ErgoFlex_Custom_Shop/app-reference/assets/google_fonts/Poppins-SemiBold.ttf'
BEAT = 12.5 / 24          # music section 0.75–13.25 s = 6 bars of 4 beats
SHOT = 3 * BEAT
TOTAL = 15.0
# (file, source in-point s, year, label, retro?)
SHOTS = [
    ('smb-nes.mp4', 6.6, '1985', 'Super Mario Bros.', True),      # title card, covers the dissolve
    ('smb-nes.mp4', 15.6, '1985', 'Super Mario Bros.', True),
    ('mario.mp4', 1.0, '2023', 'Super Mario Bros. Wonder', False),
    ('smk-snes.mp4', 0.2, '1992', 'Super Mario Kart', True),
    ('kart.mp4', 0.5, '2017', 'Mario Kart 8 Deluxe', False),
    ('sf2-snes.mp4', 1.5, '1993', 'Street Fighter II Turbo', True),
    ('sf6.mp4', 21.0, '2023', 'Street Fighter 6', False),
    ('doom-1993.mp4', 7.3, '1993', 'DOOM', True),
    ('fps.mp4', 22.0, '2021', 'Halo Infinite', False),
]
starts = [0.0, 0.75] + [0.75 + SHOT * i for i in range(1, len(SHOTS) - 1)]
ends = starts[1:] + [TOTAL]

inputs, chains = [], []
for i, ((f, at, year, label, retro), a, b) in enumerate(zip(SHOTS, starts, ends)):
    d = b - a
    inputs += ['-ss', f'{at:.3f}', '-t', f'{d + .2:.3f}', '-i', f'{src}/{f}']
    base = f'[{i}:v]fps=30,trim=0:{d:.4f},setpts=PTS-STARTPTS'
    if f == 'smk-snes.mp4': base += ',crop=iw:ih*0.935:0:0'  # drop the uploader watermark under the map
    if retro:
        chains.append(f'{base},split[r{i}a][r{i}b];'
                      f'[r{i}a]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},gblur=sigma=30,eq=brightness=-0.18:saturation=0.8[bg{i}];'
                      f'[r{i}b]scale=-2:{H}:flags=neighbor[fg{i}];[bg{i}][fg{i}]overlay=(W-w)/2:0[p{i}]')
    else:
        chains.append(f'{base},scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}[p{i}]')
    # Year badge, kept inside the centre band so a 21:9 cover crop keeps it.
    y0 = int(H * .16)
    chains.append(f"[p{i}]drawbox=x={int(W*.035)}:y={y0}:w={int(H*.30)}:h={int(H*.115)}:color=black@0.55:t=fill,"
                  f"drawtext=fontfile={FONT}:text='{year}':fontsize={int(H*.075)}:fontcolor=white:x={int(W*.035)+int(H*.025)}:y={y0+int(H*.012)},"
                  f"drawtext=fontfile={FONT}:text='{label}':fontsize={int(H*.028)}:fontcolor=0x9fd2ff:x={int(W*.035)+int(H*.028)}:y={y0+int(H*.13)},"
                  f"format=yuv420p,setsar=1[s{i}]")
graph = ';'.join(chains) + ';' + ''.join(f'[s{i}]' for i in range(len(SHOTS))) + f'concat=n={len(SHOTS)}:v=1:a=0[v]'
subprocess.run(['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', graph, '-map', '[v]', '-r', '30',
                '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-t', str(TOTAL), out], check=True)
print(out, 'cuts at', [round(s, 3) for s in starts])
