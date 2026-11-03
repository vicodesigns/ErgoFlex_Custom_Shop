#!/usr/bin/env python3
"""Join a chapter's sub-shot renders into one chapter render with cross-dissolves.

    python3 tools/experience/join-subshots.py <subshots-cut.json> <render-dir> <out.mkv> [--transition fadeblack]

<subshots-cut.json> lists the sub-shots in order, each with renderRange [t0, t1] in chapter
seconds (build-safety-chapter.py writes one); render-cut.cjs rendered them as <render-dir>/01.mkv,
02.mkv, ... Consecutive sub-shots overlap by (previous t1 - next t0), and that overlap is the
dissolve (xfade 'fade' by default; 'fadeblack' dips through black: fade out, fade in at the
next angle, which reads cleanly over the dark studio without a double image). Output matches render-cut's chapter renders (H.264 CRF 8, yuv444p, BT.709).
"""
import json, os, subprocess, sys
cut, rdir, out = sys.argv[1:4]
trans = sys.argv[sys.argv.index('--transition') + 1] if '--transition' in sys.argv else 'fade'
subs = json.load(open(cut))['shots']
inputs, f, prev = [], [], '[0:v]'
for k, s in enumerate(subs):
    inputs += ['-i', os.path.join(rdir, f'{k + 1:02d}.mkv')]
for k in range(1, len(subs)):
    a, b = subs[k - 1]['renderRange'], subs[k]['renderRange']
    dur, off = round(a[1] - b[0], 4), round(b[0] - subs[0]['renderRange'][0], 4)
    assert dur > 0, 'sub-shots must overlap'
    f.append(f'{prev}[{k}:v]xfade=transition={trans}:duration={dur}:offset={off}[x{k}]'); prev = f'[x{k}]'
subprocess.run(['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', ';'.join(f), '-map', prev, '-r', '30',
                '-c:v', 'libx264', '-preset', 'medium', '-crf', '8', '-pix_fmt', 'yuv444p',
                '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', out], check=True)
d = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]))
print(out, f'{d:.3f} s')
