#!/usr/bin/env python3
"""Score for HQ11: a fresh score-synth pass on the re-timed EDL, with the desk's own movement sounds.

    python3 tools/experience/build-round6-audio.py exports/cinematic-intro-20261103-hq11

HQ11 (final_review_content_2026-11-04.md MUST 2): the safety card says "Light and sound", so every movement
event of the opener now carries the desk's own sound (lift up/down, tilt extend/retract, wheels), and the
rolls of commons, awareness and storage carry the wheel sound. Lift/tilt sit at -14 dB, wheels at -17 dB.
Was build-round5-audio.py (HQ10):

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
SOUND = {'lift-up': 'movement_lift_up', 'lift-down': 'movement_lift_down', 'tilt-extend': 'movement_tilt_extend',
         'tilt-retract': 'movement_tilt_retract', 'wheels': 'movement_wheels'}
LEVEL = {'wheels': -17.0}; DEFAULT_DB = -14.0
cues = []
for s in cut['shots']:
    for e in s.get('ledStatus', []):
        if s['id'] == 'awaken' and e['kind'] in SOUND or s['id'] in ('commons', 'awareness', 'storage') and e['kind'] == 'wheels':
            if s['id'] in start: cues.append((round(start[s['id']] + e['at'], 3), e['dur'], e['kind']))
# Back-to-back events of the same sound (commons: turn mode 6 then forward mode 3) play as one cue, no dip.
merged = []
for at, dur, kind in sorted(cues):
    if merged and merged[-1][2] == kind and abs(merged[-1][0] + merged[-1][1] - at) < 0.05:
        merged[-1] = (merged[-1][0], round(at + dur - merged[-1][0], 3), kind)
    else: merged.append((at, dur, kind))
cues = merged
tmp = tempfile.mkdtemp(prefix='hq11-score-'); gen = os.path.join(tmp, 'generated.wav')
subprocess.run([sys.executable, os.path.join(root, 'tools/experience/score-synth.py'), os.path.join(d, 'edl.json'), gen, '--no-extras'], check=True, stdout=subprocess.DEVNULL)
ins, f = ['-i', gen], []
for i, (at, dur, kind) in enumerate(cues):
    ins += ['-stream_loop', '-1', '-i', os.path.join(root, f'assets/led/audio/{SOUND[kind]}.mp3')]
    f.append(f'[{i + 1}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:{dur},afade=t=in:d=0.3,afade=t=out:st={dur - 0.08}:d=0.08,'
             f'volume={LEVEL.get(kind, DEFAULT_DB)}dB,adelay={int(at * 1000)}|{int(at * 1000)}[k{i}]')
f.append(''.join(['[0:a]'] + [f'[k{i}]' for i in range(len(cues))]) + f'amix=inputs={len(cues) + 1}:normalize=0:duration=first,alimiter=limit=0.89:level=false[out]')
out = os.path.join(d, 'score', 'score.wav'); os.makedirs(os.path.dirname(out), exist_ok=True)
if os.path.islink(out): os.unlink(out)
subprocess.run(['ffmpeg', '-v', 'error', '-y', *ins, '-filter_complex', ';'.join(f), '-map', '[out]', '-ar', '48000', '-c:a', 'pcm_s24le', out], check=True)
os.remove(gen); os.rmdir(tmp)
print('wrote', out, f"({edl['total']} s) | cues", ', '.join(f'{k} {a}+{b}' for a, b, k in cues))
