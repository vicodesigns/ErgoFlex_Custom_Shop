#!/usr/bin/env python3
"""finish-intro.py --chapter-titles: titles present inside their window, absent outside it, edge cases.
Run: python -X utf8 tests/finish-intro-chapter-titles-test.py   (needs ffmpeg + ffprobe on PATH; pure Python, no numpy)"""
import json, os, subprocess, sys, tempfile, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, 'tools', 'experience', 'finish-intro.py')
W, H = 320, 180
fails = []
def check(ok, msg):
    print(('PASS ' if ok else 'FAIL ') + msg); ok or fails.append(msg)
def sh(cmd, **kw): return subprocess.run(cmd, capture_output=True, **kw)
def cli(cut, *a):
    r = sh([sys.executable, '-X', 'utf8', SCRIPT, cut, *a], text=True, encoding='utf-8'); return r.returncode, r.stdout + r.stderr
def frame(path, t):
    r = sh(['ffmpeg', '-v', 'error', '-ss', str(t), '-i', path, '-frames:v', '1', '-vf', f'scale={W}:{H}', '-pix_fmt', 'gray', '-f', 'rawvideo', '-'])
    assert len(r.stdout) == W * H, f'frame at {t}: {len(r.stdout)} bytes'; return r.stdout
def changed(a, b, box, thr=24):   # pixels in box (x0,y0,x1,y1) differing by > thr
    x0, y0, x1, y1 = box
    return sum(1 for y in range(y0, y1) for x in range(x0, x1) if abs(a[y * W + x] - b[y * W + x]) > thr)

tmp = tempfile.mkdtemp(prefix='s34test-')
try:
    clip = os.path.join(tmp, 'chap.mp4')
    r = sh(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', f'color=c=0x2a4a6a:s={W}x{H}:r=30:d=5', '-f', 'lavfi', '-i', 'sine=frequency=440:d=5',
            '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', clip])
    assert r.returncode == 0, r.stderr
    cut = os.path.join(tmp, 'cut'); os.makedirs(cut)
    ttl = lambda ch, a, b, **k: dict(chapter=ch, rel_in=a, rel_out=b, eyebrow='ERGOFLEX', title='Level up your day.', detail='Better health. Clearer focus.', **k)
    json.dump(dict(titles=[ttl('awaken', 0.5, 2.5), ttl('awaken', 3.0, 4.6, place='top-right'), ttl('rise', 1.0, 2.0)],
                   cta=dict(chapter='hero', rel_in=1, text='CTA'), logo=dict(chapter='hero', rel_in=1)), open(os.path.join(cut, 'titles-src.json'), 'w'))
    out = os.path.join(tmp, 'out', 'titled.mp4')
    rc, msg = cli(cut, '--chapter-titles', 'awaken', clip, out)
    check(rc == 0 and os.path.getsize(out) > 0, f'awaken burn exits 0 and writes output ({msg.strip().splitlines()[-1:]})')
    bg = frame(out, 0.1)
    LL, TR = (0, 100, 200, 180), (120, 0, 320, 80)
    f_ll, f_gap, f_tr, f_end = frame(out, 1.9), frame(out, 2.8), frame(out, 4.0), frame(out, 4.9)
    n = lambda f, box: changed(bg, f, box)
    check(n(f_ll, LL) > 100, f'lower-left title pixels PRESENT at 1.9 s ({n(f_ll, LL)} px)')
    check(n(bg, LL) == 0 and n(f_gap, LL) < 5 and n(f_tr, LL) < 5 and n(f_end, LL) < 5, 'lower-left title ABSENT before 0.5 s and after its window')
    check(n(f_tr, TR) > 100, f'place top-right title pixels PRESENT at 4.0 s ({n(f_tr, TR)} px)')
    check(n(f_ll, TR) < 5 and n(f_gap, TR) < 5 and n(f_end, TR) < 5, 'top-right title ABSENT before 3.0 s and after its window')
    check(n(f_tr, (0, 100, 120, 180)) < 5, 'top-right title is right of the lower-left region (own placement)')
    pi = lambda p, e: json.loads(sh(['ffprobe', '-v', 'error', '-show_entries', e, '-of', 'json', p], text=True).stdout)
    vin, vout = pi(clip, 'format=duration')['format'], pi(out, 'format=duration')['format']
    check(abs(float(vin['duration']) - float(vout['duration'])) < 0.15, f"duration kept ({vin['duration']} -> {vout['duration']})")
    ast = pi(out, 'stream=codec_name,r_frame_rate')['streams']
    check([s['codec_name'] for s in ast] == ['h264', 'aac'] and ast[0]['r_frame_rate'] == '30/1', 'h264 + audio stream kept, 30 fps')
    # edge: unknown chapter -> non-zero, clear message, no output
    bad = os.path.join(tmp, 'bad', 'x.mp4'); rc, msg = cli(cut, '--chapter-titles', 'nosuch', clip, bad)
    check(rc != 0 and 'unknown chapter id' in msg and not os.path.exists(bad) and not os.path.exists(os.path.dirname(bad)), f'unknown chapter: exit {rc}, message, no output')
    # edge: chapter with no titles -> plain copy (byte-identical), no error. 'hero' only owns the CTA/logo, never a chapter title.
    cp = os.path.join(tmp, 'copy.mp4'); rc, msg = cli(cut, '--chapter-titles', 'hero', clip, cp)
    check(rc == 0 and os.path.exists(cp) and open(cp, 'rb').read() == open(clip, 'rb').read(), 'no-title chapter (hero CTA is film-only): plain byte copy')
    # edge: missing input -> non-zero, no output
    rc, msg = cli(cut, '--chapter-titles', 'awaken', os.path.join(tmp, 'nope.mp4'), os.path.join(tmp, 'o2.mp4'))
    check(rc != 0 and not os.path.exists(os.path.join(tmp, 'o2.mp4')), 'missing input: non-zero, no output')
finally:
    shutil.rmtree(tmp, ignore_errors=True)
print('FAILED: ' + '; '.join(fails) if fails else 'ALL PASS'); sys.exit(1 if fails else 0)
