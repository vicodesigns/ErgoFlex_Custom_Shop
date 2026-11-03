#!/usr/bin/env python3
"""Score for the 'status' chapter: splice a bridge into the existing score and lay the app's real sounds on it.

    python3 tools/experience/build-status-audio.py exports/cinematic-intro-20261103 exports/cinematic-intro-20261103-hq6

<src>/score/score.wav is cut at the coast -> status dissolve centre (the bar line where the next
section starts), a bridge as long as the new chapter's contribution to the film is inserted, and
the rest of the score follows unchanged, so every later cue stays on its bar line, just later.
Bridge: the 'wake' pad of the opening (Dmaj9, 3.586-16.0 s of the score, the same dark studio),
stretched with atempo; it resolves the coast chapter's A and ends on the Asus4 that wake ends on.
Sounds (the app's own files in assets/led/audio, from ergoflex_api/audio/safety_indicators):
movement_lift_up / movement_lift_down / movement_wheels / target_reached / collision_alarm.
Cue times follow the ledStatus schedule in <dst>/shots/06.json (chapter seconds), offset by the
chapter's start in <dst>/edl.json.
"""
import json, os, subprocess, sys
src, dst = sys.argv[1], sys.argv[2]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AUDIO = os.path.join(root, 'assets/led/audio')
edl = json.load(open(os.path.join(dst, 'edl.json'))); shot = json.load(open(os.path.join(dst, 'shots', '06.json')))
ch = {c['id']: c for c in edl['chapters']}; X = edl['dissolve']
coast, status = ch['coast'], ch['status']
cut = round(coast['end'] - X / 2, 3)                       # 86.25: the coast -> status dissolve centre (unchanged by the insert)
added = round(edl['total'] - json.load(open(os.path.join(src, 'edl.json')))['total'], 3)   # 14.5 s the film grew by
XF = 0.3                                                   # crossfade at each splice
bridge_len = added + 2 * XF
WAKE0, WAKE1 = 3.586, 16.0
tempo = (WAKE1 - WAKE0) / bridge_len                       # atempo < 1 slows the pad down

# (file, chapter t0, duration, gain dB, fade in/out) for each cue. Lifts and wheels play the start of the app's tone.
ev = shot['ledStatus']; at = lambda kind, **kw: next(e for e in ev if e['kind'] == kind and all(e.get(k) == v for k, v in kw.items()))
wheels = [e for e in ev if e['kind'] == 'wheels']
cues = [('movement_lift_up', at('lift-up')['at'], at('lift-up')['dur'], -5, .15, .3),
        ('target_reached', at('target')['at'], 1.0, 0, 0, .1),
        ('movement_lift_down', at('lift-down')['at'], at('lift-down')['dur'], -5, .15, .3),
        ('movement_wheels', wheels[0]['at'], (wheels[-2]['at'] + wheels[-2]['dur']) - wheels[0]['at'], -5, .15, .3),   # ring, turn and approach
        ('collision_alarm', at('collision')['at'], at('collision')['dur'], -5, 0, .25),
        ('movement_wheels', wheels[-1]['at'], wheels[-1]['dur'], -5, .15, .3)]                                         # back away
inputs = ['-i', os.path.join(src, 'score', 'score.wav')]
for name, *_ in cues: inputs += ['-i', os.path.join(AUDIO, name + '.mp3')]
f = [f'[0:a]atrim=0:{cut},asetpts=N/SR/TB[a]',
     f'[0:a]atrim={WAKE0}:{WAKE1},asetpts=N/SR/TB,atempo={tempo:.5f},volume=-2dB[b]',
     f'[0:a]atrim={cut},asetpts=N/SR/TB[c]',
     f'[a][b]acrossfade=d={XF}:c1=tri:c2=tri[ab]', f'[ab][c]acrossfade=d={XF}:c1=tri:c2=tri[score]']
labels = ['[score]']
for i, (name, t0, dur, db, fi, fo) in enumerate(cues, start=1):
    T = round(status['start'] + t0, 3)
    chain = f'[{i}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:{dur:.3f},asetpts=N/SR/TB'
    if fi: chain += f',afade=t=in:d={fi}'
    chain += f',afade=t=out:st={max(0, dur - fo):.3f}:d={fo},volume={db}dB,adelay={int(T * 1000)}|{int(T * 1000)}[k{i}]'
    f.append(chain); labels.append(f'[k{i}]')
f.append(''.join(labels) + f'amix=inputs={len(labels)}:normalize=0:duration=first,alimiter=limit=0.89:level=false[out]')
out = os.path.join(dst, 'score', 'score.wav'); os.makedirs(os.path.dirname(out), exist_ok=True)
if os.path.islink(out): os.unlink(out)
subprocess.run(['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', ';'.join(f), '-map', '[out]', '-ar', '48000', '-c:a', 'pcm_s24le', out], check=True)
print('wrote', out, 'cut at', cut, 'bridge', round(bridge_len, 3), 's, atempo', round(tempo, 4))
