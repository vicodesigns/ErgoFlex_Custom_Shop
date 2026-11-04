#!/usr/bin/env python3
"""Score for HQ8: the safety slot without the chime, one desk cue under the roll, a new finale.

    python3 tools/experience/build-hq8-audio.py exports/cinematic-intro-20261103-hq7 exports/cinematic-intro-20261103-hq8

1. score-synth.py renders the whole score from <dst>/edl.json (197 s; the 23 s finale uses
   the 'finale' style: one chord per preset look, logo hit on the 191.32 end card).
2. Two slots are taken from it, joined to <src>'s score with 0.3 s crossfades centred on
   the bar lines: the safety chapter (dissolve centres 86.25-100.75, the 'status' section
   as in HQ7 but without HQ7's target_reached chime: no arrival cue, Vico's note 1) and
   everything from the storage>hero centre (174.75) to the end.
3. The desk's own movement_wheels sound (assets/led/audio) plays under the roll to the
   pylon, 18 dB down with a 0.3 s fade in, cut with an 80 ms fade as the desk stops, so
   the stop is heard as the tone ending while the amber rises. No proximity sound: the
   desk has none.
"""
import json, os, subprocess, sys, tempfile
src, dst = sys.argv[1], sys.argv[2]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
edl = json.load(open(os.path.join(dst, 'edl.json'))); shot = json.load(open(os.path.join(dst, 'shots', '06.json')))
chs = sorted(edl['chapters'], key=lambda c: c['index']); ids = [c['id'] for c in chs]
centre = lambda i: round((chs[i]['end'] + chs[i + 1]['start']) / 2, 3)   # dissolve centre after chapter i
k = ids.index('status')
s_in, s_out, f_in = centre(k - 1), centre(k), centre(ids.index('hero') - 1)   # 86.25, 100.75, 174.75
roll = next(e for e in shot['ledStatus'] if e['kind'] == 'wheels' and e['mode'] == 3)
cue_at, cue_dur = round(chs[k]['start'] + roll['at'], 3), roll['dur']
XF, h = 0.3, 0.15
CUE_DB = -18.0

tmp = tempfile.mkdtemp(prefix='hq8-score-')
gen = os.path.join(tmp, 'generated.wav')
subprocess.run([sys.executable, os.path.join(root, 'tools/experience/score-synth.py'), os.path.join(dst, 'edl.json'), gen, '--no-extras'], check=True, stdout=subprocess.DEVNULL)
old = os.path.join(src, 'score', 'score.wav')
f = [f'[0:a]atrim=0:{s_in + h},asetpts=N/SR/TB[a]',
     f'[1:a]atrim={s_in - h}:{s_out + h},asetpts=N/SR/TB[b]',
     f'[0:a]atrim={s_out - h}:{f_in + h},asetpts=N/SR/TB[c]',
     f'[1:a]atrim={f_in - h},asetpts=N/SR/TB[d]',
     f'[a][b]acrossfade=d={XF}:c1=tri:c2=tri[ab]', f'[ab][c]acrossfade=d={XF}:c1=tri:c2=tri[abc]',
     f'[abc][d]acrossfade=d={XF}:c1=tri:c2=tri[score]',
     f'[2:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:{cue_dur},afade=t=in:d=0.3,afade=t=out:st={cue_dur - 0.08}:d=0.08,'
     f'volume={CUE_DB}dB,adelay={int(cue_at * 1000)}|{int(cue_at * 1000)}[k]',
     '[score][k]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.89:level=false[out]']
out = os.path.join(dst, 'score', 'score.wav'); os.makedirs(os.path.dirname(out), exist_ok=True)
if os.path.islink(out): os.unlink(out)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', old, '-i', gen, '-stream_loop', '-1', '-i', os.path.join(root, 'assets/led/audio/movement_wheels.mp3'),
                '-filter_complex', ';'.join(f), '-map', '[out]', '-ar', '48000', '-c:a', 'pcm_s24le', out], check=True)
os.remove(gen); os.rmdir(tmp)
print('wrote', out, '| safety slot', s_in, '-', s_out, '| finale from', f_in, '| wheels cue', cue_at, '+', cue_dur)
