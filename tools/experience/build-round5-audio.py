#!/usr/bin/env python3
"""Score for HQ10: a fresh score-synth pass on the re-timed EDL, with the desk's own wheel sound.

    python3 tools/experience/build-round5-audio.py exports/cinematic-intro-20261103-hq10

HQ7-HQ9 spliced new slots into older scores; HQ10 moves every chapter after the opener (the safety
chapter is cut), so the whole score is synthesized from <dir>/edl.json (tempo map on the new dissolve
centres, title B = the opener's safety card). The desk's movement_wheels sound (assets/led/audio) plays
under every wheels ledStatus event of the opener and under ch 9's roll to the pylon, 18 dB down, 0.3 s
fade in, cut with an 80 ms fade as the desk stops (as in HQ8). No proximity sound: the desk has none.
"""
import json, os, subprocess, sys, tempfile
d = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
edl = json.load(open(os.path.join(d, 'edl.json'))); cut = json.load(open(os.path.join(d, 'review-cut.json')))
start = {c['id']: c['start'] for c in edl['chapters']}
CUE_DB = -18.0
cues = []
for s in cut['shots']:
    if s['id'] not in ('awaken', 'awareness'): continue
    for e in s.get('ledStatus', []):
        if e['kind'] == 'wheels' and (s['id'] == 'awaken' or e.get('mode') == 3):
            cues.append((round(start[s['id']] + e['at'], 3), e['dur']))
tmp = tempfile.mkdtemp(prefix='hq10-score-'); gen = os.path.join(tmp, 'generated.wav')
subprocess.run([sys.executable, os.path.join(root, 'tools/experience/score-synth.py'), os.path.join(d, 'edl.json'), gen, '--no-extras'], check=True, stdout=subprocess.DEVNULL)
wheels = os.path.join(root, 'assets/led/audio/movement_wheels.mp3')
ins, f = ['-i', gen], []
for i, (at, dur) in enumerate(cues):
    ins += ['-stream_loop', '-1', '-i', wheels]
    f.append(f'[{i + 1}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:{dur},afade=t=in:d=0.3,afade=t=out:st={dur - 0.08}:d=0.08,'
             f'volume={CUE_DB}dB,adelay={int(at * 1000)}|{int(at * 1000)}[k{i}]')
f.append(''.join(['[0:a]'] + [f'[k{i}]' for i in range(len(cues))]) + f'amix=inputs={len(cues) + 1}:normalize=0:duration=first,alimiter=limit=0.89:level=false[out]')
out = os.path.join(d, 'score', 'score.wav'); os.makedirs(os.path.dirname(out), exist_ok=True)
if os.path.islink(out): os.unlink(out)
subprocess.run(['ffmpeg', '-v', 'error', '-y', *ins, '-filter_complex', ';'.join(f), '-map', '[out]', '-ar', '48000', '-c:a', 'pcm_s24le', out], check=True)
os.remove(gen); os.rmdir(tmp)
print('wrote', out, f"({edl['total']} s) | wheels cues", ', '.join(f'{a}+{b}' for a, b in cues))
